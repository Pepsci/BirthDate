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

        guard
            let cipherB64 = (data["cipher"] as? String),
            let senderPkB64 = (data["senderPublicKey"] as? String)
        else {
            // Pas de données chiffrées → on laisse le fallback tel quel.
            contentHandler(content)
            return
        }

        if let plaintext = decrypt(cipherB64: cipherB64, senderPkB64: senderPkB64) {
            if let name = data["senderName"] as? String {
                content.title = "💬 \(name)"
            }
            content.body = plaintext
        }
        // Si échec : on garde le fallback "🔒 Nouveau message chiffré".
        contentHandler(content)
    }

    override func serviceExtensionTimeWillExpire() {
        // Temps imparti dépassé → afficher ce qu'on a (fallback probable).
        if let handler = contentHandler, let content = bestAttempt {
            handler(content)
        }
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
