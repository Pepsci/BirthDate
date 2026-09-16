//
//  NotificationService.swift
//  BirthReminderNSE (Notification Service Extension)
//
//  Rôle : intercepter les push chiffrées, déchiffrer le message localement
//  (le serveur n'envoie QUE le chiffré), et réécrire le corps de la notif
//  avant affichage. Équivalent iOS de la tâche de fond Android.
//
//  Dépendance : swift-sodium (jedisct1/swift-sodium) — même primitive que
//  tweetnacl côté JS : crypto_box (X25519 + XSalsa20-Poly1305).
//  Le format `cipher` = base64(nonce(24) ‖ ciphertext) correspond EXACTEMENT
//  à `box.open(nonceAndAuthenticatedCipherText:...)`.
//
//  Prérequis d'intégration (voir ios-nse/README.md) :
//    - App Group "group.com.birthreminder.app" partagé app ↔ extension
//    - La clé privée E2E doit être stockée dans le Keychain de cet App Group
//      (cf. keychainAccessGroup dans mobile/src/lib/crypto.ts)
//    - Le backend envoie pour iOS : mutable-content + data.cipher/senderPublicKey
//

import UserNotifications
import Sodium
import Security

class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttempt: UNMutableNotificationContent?

    // ⚠️ Doit correspondre à l'App Group configuré dans les entitlements.
    private let appGroup = "group.com.birthreminder.app"
    // Clé de stockage utilisée par expo-secure-store (voir crypto.ts).
    private let privateKeyAccount = "e2ePrivateKey"

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler
        self.bestAttempt = (request.content.mutableCopy() as? UNMutableNotificationContent)

        guard let content = bestAttempt else {
            contentHandler(request.content)
            return
        }

        // userInfo est [AnyHashable: Any] → on le convertit en [String: Any].
        let userInfo = (request.content.userInfo as? [String: Any]) ?? [:]
        // Les champs sont dans `body` (data-only Expo) ou à la racine selon l'envoi.
        let data = (userInfo["body"] as? [String: Any]) ?? userInfo

        if
            let cipherB64 = (data["cipher"] as? String),
            let senderPkB64 = (data["senderPublicKey"] as? String),
            let plaintext = decrypt(cipherB64: cipherB64, senderPkB64: senderPkB64)
        {
            if let name = data["senderName"] as? String {
                content.title = "💬 \(name)"
            }
            content.body = plaintext
        }
        // Si pas de chiffré ou échec : on garde le fallback "🔒 Nouveau message chiffré".

        // ⚠️ L'accusé part AVANT contentHandler : iOS peut tuer l'extension dès
        // que la notification est rendue, et la requête serait coupée net.
        reportDelivery(data) { [weak self] in
            self?.deliver(content)
        }
    }

    // MARK: - Accusé « distribué »

    /// Prévient le serveur que la push (donc le message) est arrivée sur
    /// l'appareil : l'expéditeur voit alors ✓✓ au lieu de ✓, comme WhatsApp.
    ///
    /// Pas de JWT ici (l'extension n'y a pas accès) : la push embarque un jeton
    /// HMAC valable uniquement pour ce message et ce destinataire.
    /// Délai court et échec silencieux : l'affichage de la notification ne doit
    /// jamais attendre le réseau plus de 4 s.
    private func reportDelivery(_ data: [String: Any], completion: @escaping () -> Void) {
        guard
            let urlString = data["receiptUrl"] as? String,
            let url = URL(string: urlString),
            let messageId = data["messageId"] as? String,
            let recipientId = data["recipientId"] as? String,
            let token = data["receiptToken"] as? String,
            let body = try? JSONSerialization.data(withJSONObject: [
                "messageId": messageId,
                "recipientId": recipientId,
                "receiptToken": token,
            ])
        else {
            completion()
            return
        }

        var request = URLRequest(url: url, timeoutInterval: 4)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body

        URLSession.shared.dataTask(with: request) { _, _, _ in
            completion()
        }.resume()
    }

    override func serviceExtensionTimeWillExpire() {
        // Temps imparti dépassé → afficher ce qu'on a (fallback probable).
        if let content = bestAttempt {
            deliver(content)
        }
    }

    /// Rend la notification une seule fois : la fin de l'accusé réseau et
    /// l'expiration du délai peuvent toutes deux arriver ici.
    private func deliver(_ content: UNNotificationContent) {
        guard let handler = contentHandler else { return }
        contentHandler = nil
        handler(content)
    }

    // MARK: - Déchiffrement

    private func decrypt(cipherB64: String, senderPkB64: String) -> String? {
        let sodium = Sodium()

        guard
            let combined = sodium.utils.base642bin(cipherB64, variant: .ORIGINAL),
            let senderPk = sodium.utils.base642bin(senderPkB64, variant: .ORIGINAL),
            let mySk = loadPrivateKey(sodium: sodium)
        else { return nil }

        // Format nonce ‖ ciphertext → box.open direct.
        guard
            let opened = sodium.box.open(
                nonceAndAuthenticatedCipherText: combined,
                senderPublicKey: senderPk,
                recipientSecretKey: mySk
            )
        else { return nil }

        return String(bytes: opened, encoding: .utf8)
    }

    /// Lit la clé privée E2E depuis le Keychain partagé de l'App Group.
    ///
    /// ⚠️ Il faut interroger le Keychain EXACTEMENT comme expo-secure-store y a
    /// écrit, et sa façon de faire n'est pas celle qu'on suppose (voir
    /// node_modules/expo-secure-store/ios/SecureStoreModule.swift, `query(with:)`) :
    ///
    ///   - `kSecAttrAccount` vaut `Data(key.utf8)`, PAS la chaîne "e2ePrivateKey".
    ///     Une requête avec une String ne matche pas un attribut stocké en Data,
    ///     et SecItemCopyMatching renvoie simplement errSecItemNotFound. Silence
    ///     total : l'extension retombait sur le fallback "🔒 Nouveau message
    ///     chiffré" sans qu'aucune erreur n'apparaisse nulle part. C'est LE bug
    ///     qui faisait croire que la NSE n'était pas installée.
    ///
    ///   - `kSecAttrService` vaut "app:no-auth" et non "app" : le module suffixe
    ///     le service avec le mode d'authentification au moment de l'écriture
    ///     (`requireAuthentication` vaut false par défaut, donc ":no-auth").
    ///
    /// On essaie donc plusieurs combinaisons, de la plus probable à la plus
    /// permissive, pour rester robuste si expo-secure-store change ses
    /// conventions ou si une clé subsiste d'une version antérieure.
    private func loadPrivateKey(sodium: Sodium) -> [UInt8]? {
        let accountData = Data(privateKeyAccount.utf8)

        // (service, valeur de kSecAttrAccount)
        let attempts: [(String?, Any)] = [
            ("app:no-auth", accountData),   // écriture actuelle
            ("app", accountData),           // service sans suffixe
            ("app:auth", accountData),      // variante avec biométrie
            (nil, accountData),             // sans contrainte de service
            ("app:no-auth", privateKeyAccount), // au cas où un jour c'est une String
            (nil, privateKeyAccount),
        ]

        for (service, account) in attempts {
            var query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrAccount as String: account,
                kSecAttrAccessGroup as String: appGroup,
                kSecReturnData as String: true,
                kSecMatchLimit as String: kSecMatchLimitOne,
            ]
            if let service {
                query[kSecAttrService as String] = service
            }

            var item: CFTypeRef?
            let status = SecItemCopyMatching(query as CFDictionary, &item)
            guard status == errSecSuccess, let data = item as? Data else {
                continue
            }

            // expo-secure-store enregistre la valeur en UTF-8 ; ici c'est le
            // base64 de la clé privée (cf. storePrivateKey → encodeBase64).
            guard
                let b64 = String(data: data, encoding: .utf8),
                let bytes = sodium.utils.base642bin(b64, variant: .ORIGINAL)
            else { continue }

            return bytes
        }

        return nil
    }
}
