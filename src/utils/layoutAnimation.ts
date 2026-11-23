import { LayoutAnimation } from 'react-native';

/** Animates the next layout commit without adding create/delete fades. */
export function animateNextLayoutChange(): void {
  LayoutAnimation.configureNext({
    duration: 220,
    update: { type: LayoutAnimation.Types.easeInEaseOut },
  });
}
