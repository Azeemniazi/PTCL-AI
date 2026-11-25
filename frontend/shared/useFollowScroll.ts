import { useLayoutEffect, useRef } from 'react';

export function useFollowScroll() {
  const element = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  useLayoutEffect(() => {
    const node = element.current;
    if (node && following.current) node.scrollTop = node.scrollHeight;
  });
  return {
    ref: element,
    onScroll: () => {
      const node = element.current;
      if (node) following.current = node.scrollHeight - node.scrollTop - node.clientHeight <= 60;
    },
  };
}
