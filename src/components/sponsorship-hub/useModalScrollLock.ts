import { useEffect, type RefObject } from "react";

/**
 * Locks background scrolling while a modal is open.
 *
 * The sponsorship hub scrolls inside an inner container (not the document body),
 * so toggling `document.body.style.overflow` alone does not stop it. This hook
 * additionally blocks wheel/touch scrolling anywhere outside the modal panel,
 * while still allowing the panel itself to scroll.
 */
export function useModalScrollLock(panelRef: RefObject<HTMLElement>): void {
    useEffect(() => {
        const preventOutside = (event: Event) => {
            const panel = panelRef.current;
            if (panel && event.target instanceof Node && panel.contains(event.target)) {
                return;
            }
            event.preventDefault();
        };

        const prevBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        document.addEventListener("wheel", preventOutside, { passive: false });
        document.addEventListener("touchmove", preventOutside, { passive: false });

        return () => {
            document.body.style.overflow = prevBodyOverflow;
            document.removeEventListener("wheel", preventOutside);
            document.removeEventListener("touchmove", preventOutside);
        };
    }, [panelRef]);
}
