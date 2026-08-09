import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
};

const PARTICLE_COUNT = 30;

function createParticles(width: number, height: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    radius: Math.random() * 2 + 1,
    alpha: Math.random() * 0.6 + 0.3,
  }));
}

export function CyberCanvasBackground() {
  const { width, height } = useWindowDimensions();
  const viewWidth = Math.max(width, 1);
  const viewHeight = Math.max(height, 1);
  const particlesRef = useRef<Particle[]>(createParticles(viewWidth, viewHeight));
  const [particles, setParticles] = useState<Particle[]>(() => particlesRef.current);

  useEffect(() => {
    particlesRef.current = createParticles(viewWidth, viewHeight);
  }, [viewHeight, viewWidth]);

  useEffect(() => {
    const timer = setInterval(() => {
      const current = particlesRef.current;
      for (const p of current) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > viewWidth) p.vx *= -1;
        if (p.y < 0 || p.y > viewHeight) p.vy *= -1;
      }
      setParticles([...current]);
    }, 50);

    return () => clearInterval(timer);
  }, [viewHeight, viewWidth]);

  return (
    <View pointerEvents="none" style={styles.background}>
      {/* Ambient Glow Orbs */}
      <View style={[styles.glowOrb1, { top: viewHeight * 0.1, left: viewWidth * 0.15 }]} />
      <View style={[styles.glowOrb2, { bottom: viewHeight * 0.1, right: viewWidth * 0.15 }]} />

      {/* Floating Star Particles */}
      {particles.map((p, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: p.radius * 2,
            height: p.radius * 2,
            borderRadius: p.radius,
            backgroundColor: '#98CBFF',
            opacity: p.alpha,
          }}
        />
      ))}
      <View style={styles.tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#050A1A',
  },
  glowOrb1: {
    position: 'absolute',
    width: 450,
    height: 450,
    borderRadius: 225,
    backgroundColor: 'rgba(0, 163, 255, 0.12)',
  },
  glowOrb2: {
    position: 'absolute',
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor: 'rgba(99, 102, 241, 0.10)',
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 10, 26, 0.25)',
  },
});
