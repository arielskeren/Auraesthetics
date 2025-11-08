'use client';

import { useEffect } from 'react';

const SCROLL_LOCK_COUNT_ATTRIBUTE = 'data-scroll-lock-count';
const ORIGINAL_OVERFLOW_ATTRIBUTE = 'data-original-overflow';
const ORIGINAL_PADDING_ATTRIBUTE = 'data-original-padding-right';
const ORIGINAL_TOUCH_ACTION_ATTRIBUTE = 'data-original-touch-action';
const ORIGINAL_OVERSCROLL_ATTRIBUTE = 'data-original-overscroll-behavior';

/**
 * Locks the <body> scroll while the component using the hook is mounted
 * and the `locked` flag is true. Supports nested modals by reference counting.
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof window === 'undefined') {
      return;
    }

    const body = document.body;
    const currentCount = Number(body.getAttribute(SCROLL_LOCK_COUNT_ATTRIBUTE) || '0');

    if (currentCount === 0) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

      // Preserve original styles so we can restore them later.
      body.setAttribute(ORIGINAL_OVERFLOW_ATTRIBUTE, body.style.overflow || '');
      body.setAttribute(ORIGINAL_PADDING_ATTRIBUTE, body.style.paddingRight || '');
      body.setAttribute(ORIGINAL_TOUCH_ACTION_ATTRIBUTE, body.style.touchAction || '');
      body.setAttribute(ORIGINAL_OVERSCROLL_ATTRIBUTE, body.style.overscrollBehavior || '');

      body.style.overflow = 'hidden';
      body.style.touchAction = 'none';
      body.style.overscrollBehavior = 'contain';

      if (scrollbarWidth > 0) {
        const computedPadding = parseFloat(window.getComputedStyle(body).paddingRight || '0');
        body.style.paddingRight = `${computedPadding + scrollbarWidth}px`;
      }
    }

    body.setAttribute(SCROLL_LOCK_COUNT_ATTRIBUTE, String(currentCount + 1));

    return () => {
      const updatedCount = Number(body.getAttribute(SCROLL_LOCK_COUNT_ATTRIBUTE) || '1') - 1;

      if (updatedCount <= 0) {
        body.style.overflow = body.getAttribute(ORIGINAL_OVERFLOW_ATTRIBUTE) || '';
        body.style.paddingRight = body.getAttribute(ORIGINAL_PADDING_ATTRIBUTE) || '';
        body.style.touchAction = body.getAttribute(ORIGINAL_TOUCH_ACTION_ATTRIBUTE) || '';
        body.style.overscrollBehavior = body.getAttribute(ORIGINAL_OVERSCROLL_ATTRIBUTE) || '';

        body.removeAttribute(ORIGINAL_OVERFLOW_ATTRIBUTE);
        body.removeAttribute(ORIGINAL_PADDING_ATTRIBUTE);
        body.removeAttribute(ORIGINAL_TOUCH_ACTION_ATTRIBUTE);
        body.removeAttribute(ORIGINAL_OVERSCROLL_ATTRIBUTE);
        body.removeAttribute(SCROLL_LOCK_COUNT_ATTRIBUTE);
      } else {
        body.setAttribute(SCROLL_LOCK_COUNT_ATTRIBUTE, String(updatedCount));
      }
    };
  }, [locked]);
}

