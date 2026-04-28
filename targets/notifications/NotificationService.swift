import UserNotifications

class NotificationService: UNNotificationServiceExtension {
    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttempt: UNMutableNotificationContent?

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler
        bestAttempt = request.content.mutableCopy() as? UNMutableNotificationContent
        guard let content = bestAttempt else {
            contentHandler(request.content)
            return
        }

        let userInfo = content.userInfo
        let urlString = Self.extractImageURL(from: userInfo)

        guard let str = urlString, let url = URL(string: str) else {
            contentHandler(content)
            return
        }

        URLSession.shared.downloadTask(with: url) { tmp, response, _ in
            defer { contentHandler(content) }
            guard let tmp = tmp else { return }

            var ext = url.pathExtension
            if ext.isEmpty {
                if let mime = response?.mimeType {
                    if mime.contains("png") { ext = "png" }
                    else if mime.contains("webp") { ext = "webp" }
                    else if mime.contains("gif") { ext = "gif" }
                    else { ext = "jpg" }
                } else {
                    ext = "jpg"
                }
            }

            let dest = URL(fileURLWithPath: NSTemporaryDirectory())
                .appendingPathComponent(UUID().uuidString + "." + ext)

            do {
                try FileManager.default.moveItem(at: tmp, to: dest)
                let attachment = try UNNotificationAttachment(
                    identifier: "image",
                    url: dest,
                    options: nil
                )
                content.attachments = [attachment]
            } catch {
                NSLog("ZirklyNSE attachment error: \(error.localizedDescription)")
            }
        }.resume()
    }

    override func serviceExtensionTimeWillExpire() {
        if let handler = contentHandler, let content = bestAttempt {
            handler(content)
        }
    }

    private static func extractImageURL(from userInfo: [AnyHashable: Any]) -> String? {
        if let direct = userInfo["image_url"] as? String, !direct.isEmpty {
            return direct
        }
        if let fcm = userInfo["fcm_options"] as? [String: Any],
           let img = fcm["image"] as? String, !img.isEmpty {
            return img
        }
        if let aps = userInfo["aps"] as? [String: Any],
           let fcm = aps["fcm_options"] as? [String: Any],
           let img = fcm["image"] as? String, !img.isEmpty {
            return img
        }
        return nil
    }
}
