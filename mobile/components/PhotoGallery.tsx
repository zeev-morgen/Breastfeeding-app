import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GALLERY } from '@/assets/gallery';

const AUTO_ADVANCE_MS = 6000;
// Photos sit inside the home-screen scroll with 20px horizontal padding;
// match that so each slide is full-bleed inside the card.
const HORIZONTAL_INSET = 40;
const CARD_HEIGHT = 220;

export function PhotoGallery() {
  // Nothing to render until the user actually drops files into
  // mobile/assets/gallery/. Keeps the home screen clean by default.
  if (GALLERY.length === 0) return null;

  const screenWidth = Dimensions.get('window').width;
  const slideWidth = screenWidth - HORIZONTAL_INSET;

  const [index, setIndex] = useState(0);
  // While the user is dragging we pause auto-advance so we don't fight them.
  const userInteracting = useRef(false);
  const listRef = useRef<FlatList<(typeof GALLERY)[number]>>(null);

  useEffect(() => {
    if (GALLERY.length <= 1) return;
    const id = setInterval(() => {
      if (userInteracting.current) return;
      const next = (index + 1) % GALLERY.length;
      listRef.current?.scrollToOffset({ offset: next * slideWidth, animated: true });
      setIndex(next);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [index, slideWidth]);

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
    setIndex(Math.max(0, Math.min(GALLERY.length - 1, i)));
  };

  return (
    <View style={s.card}>
      <FlatList
        ref={listRef}
        data={GALLERY}
        keyExtractor={(_, i) => `gallery-${i}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={slideWidth}
        decelerationRate="fast"
        onScrollBeginDrag={() => {
          userInteracting.current = true;
        }}
        onScrollEndDrag={() => {
          // Give the user a moment after they let go before auto-advance kicks in.
          setTimeout(() => {
            userInteracting.current = false;
          }, 2000);
        }}
        onMomentumScrollEnd={handleMomentumEnd}
        getItemLayout={(_, i) => ({ length: slideWidth, offset: slideWidth * i, index: i })}
        renderItem={({ item }) => (
          <View style={[s.slide, { width: slideWidth }]}>
            <Image source={item.source} style={s.image} resizeMode="cover" />
            {item.caption ? (
              <View style={s.captionOverlay}>
                <Text style={s.caption} numberOfLines={2}>
                  {item.caption}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      />

      {GALLERY.length > 1 && (
        <View style={s.dotsRow}>
          {GALLERY.map((_, i) => (
            <View
              key={i}
              style={[s.dot, i === index && s.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const SURFACE = '#FBF6EE';
const INK = '#2B1F1A';
const INK_SOFT = '#6B5A50';
const PRIMARY = '#C76A4A';
const LINE = '#E6DBCB';

const s = StyleSheet.create({
  card: {
    backgroundColor: SURFACE,
    borderRadius: 24,
    overflow: 'hidden',
    paddingBottom: 12,
  },
  slide: {
    height: CARD_HEIGHT,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: LINE,
  },
  captionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(43,31,26,0.55)',
  },
  caption: {
    color: '#fff',
    fontFamily: 'serif',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
    letterSpacing: 0.2,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: LINE,
  },
  dotActive: {
    backgroundColor: PRIMARY,
    width: 18,
  },
  // Reserved so we can later show INK / INK_SOFT-colored hints inside the
  // empty-state UI without re-creating the style.
  hint: { color: INK_SOFT },
  hintBold: { color: INK, fontWeight: '600' },
});
