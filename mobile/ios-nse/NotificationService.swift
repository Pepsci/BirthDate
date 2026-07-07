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

        let userInfo = request.content.userInfo
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
            let combined = sodium.utils.base642bin(cipherB64, variant: .original),
            let senderPk = sodium.utils.base642bin(senderPkB64, variant: .original),
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
    /// expo-secure-store stocke une string base64 ; on la reconvertit en octets.
    private func loadPrivateKey(sodium: Sodium) -> [UInt8]? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: privateKeyAccount,
            kSecAttrAccessGroup as String: appGroup,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }

        // expo-secure-store enregistre la valeur en UTF-8 ; ici c'est le base64
        // de la clé privée (cf. storePrivateKey → encodeBase64).
        guard let b64 = String(data: data, encoding: .utf8) else { return nil }
        return sodium.utils.base642bin(b64, variant: .original)
    }
}
