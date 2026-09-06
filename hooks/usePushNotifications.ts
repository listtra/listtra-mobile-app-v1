import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { pushNotificationService } from "../services/pushNotificationService";

/**
 * Registers the device for push notifications when the user is authenticated,
 * unregisters on logout, and routes notification taps to the right screen.
 *
 * Mount this once at the app root (inside AuthProvider).
 */
export function usePushNotifications() {
  const { isAuthenticated, tokens } = useAuth();
  const router = useRouter();
  const registeredTokenRef = useRef<string | null>(null);
  const lastHandledIdRef = useRef<string | null>(null);

  // ---------- (Un)register device token on auth changes ----------
  useEffect(() => {
    let cancelled = false;
    const accessToken = tokens?.accessToken;

    if (isAuthenticated && accessToken) {
      (async () => {
        const deviceToken =
          await pushNotificationService.registerForPushNotificationsAsync(
            accessToken,
          );
        if (!cancelled && deviceToken) {
          registeredTokenRef.current = deviceToken;
        }
      })();
    } else if (!isAuthenticated && registeredTokenRef.current && accessToken) {
      // Already cleared; access token gone — best effort unregister
      const dt = registeredTokenRef.current;
      registeredTokenRef.current = null;
      pushNotificationService
        .unregisterPushToken(accessToken, dt)
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, tokens?.accessToken]);

  // ---------- Tap handling: route via expo-router ----------
  const handleTap = (
    data: Record<string, any> | null | undefined,
    notificationId?: string,
  ) => {
    if (!data) return;
    if (notificationId && lastHandledIdRef.current === notificationId) return;
    if (notificationId) lastHandledIdRef.current = notificationId;

    const subType = data.sub_type;
    const conversationId = data.conversation_id;
    const slug = data.listing_slug;
    const productId = data.product_id;
    const objectId: string =
      typeof data.object_id === "string" ? data.object_id : "";

    // Seller-facing offer events + accepted (buyer arranges collection in
    // chat) → chat
    if (
      subType === "offer_received" ||
      subType === "offer_modified" ||
      subType === "offer_cancelled" ||
      subType === "offer_accepted"
    ) {
      const id =
        conversationId ||
        (objectId.startsWith("conversation:") ? objectId.split(":")[1] : null);
      if (id) {
        router.push({
          pathname: "/chat/[id]",
          params: { id: String(id) },
        } as any);
        return;
      }
    }

    // Buyer-facing offer events + price drop + item sold → listing
    if (
      subType === "offer_accepted" ||
      subType === "offer_declined" ||
      subType === "price_drop" ||
      subType === "item_sold"
    ) {
      if (slug && productId) {
        router.push({
          pathname: "/listings/[slug]/[product_id]/page",
          params: { slug: String(slug), product_id: String(productId) },
        } as any);
        return;
      }
    }

    // Generic fallbacks based on object_id format
    if (objectId.startsWith("conversation:")) {
      router.push({
        pathname: "/chat/[id]",
        params: { id: objectId.split(":")[1] },
      } as any);
      return;
    }
    if (objectId.includes(":")) {
      const [s, pid] = objectId.split(":");
      if (s && pid) {
        router.push({
          pathname: "/listings/[slug]/[product_id]/page",
          params: { slug: s, product_id: pid },
        } as any);
        return;
      }
    }
  };

  // ---------- Listeners: foreground tap, background tap, killed-state launch ----------
  useEffect(() => {
    let responseSub: any;
    let receivedSub: any;
    let cancelled = false;

    (async () => {
      // Killed-state launch: app opened from a tap
      const last = await pushNotificationService.getLastNotificationResponse();
      if (last?.notification?.request?.content?.data) {
        handleTap(
          last.notification.request.content.data as any,
          last.notification.request.identifier,
        );
      }

      if (cancelled) return;

      responseSub =
        await pushNotificationService.addNotificationResponseReceivedListener(
          (response) => {
            const data = response?.notification?.request?.content?.data;
            const id = response?.notification?.request?.identifier;
            handleTap(data as any, id);
          },
        );

      // Foreground arrival: handler in service shows banner; nothing else here.
      receivedSub =
        await pushNotificationService.addNotificationReceivedListener(() => {});
    })();

    return () => {
      cancelled = true;
      try {
        responseSub?.remove?.();
      } catch {}
      try {
        receivedSub?.remove?.();
      } catch {}
    };
    // Router is stable; handleTap closes over it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
