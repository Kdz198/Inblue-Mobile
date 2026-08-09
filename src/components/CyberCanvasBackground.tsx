import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

type NativeParticle = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  opacity: number;
  duration: number;
  progress: Animated.Value;
};

function NativeCyberBackground() {
  const { width, height } = useWindowDimensions();
  const particles = useRef<NativeParticle[]>(
    Array.from({ length: 22 }, (_, index) => ({
      x: Math.round(Math.random() * Math.max(width, 900)),
      y: Math.round(Math.random() * Math.max(height, 700)),
      dx: 28 + Math.random() * 100,
      dy: -24 - Math.random() * 84,
      size: index % 5 === 0 ? 3 : 2,
      opacity: 0.2 + Math.random() * 0.48,
      duration: 5600 + Math.round(Math.random() * 5800),
      progress: new Animated.Value(Math.random()),
    }))
  ).current;
  useEffect(() => {
    const particleAnimations = particles.map(particle =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(particle.progress, {
            toValue: 1,
            duration: particle.duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(particle.progress, {
            toValue: 0,
            duration: particle.duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      )
    );
    particleAnimations.forEach(animation => animation.start());
    return () => particleAnimations.forEach(animation => animation.stop());
  }, [particles]);

  return (
    <View pointerEvents="none" style={styles.nativeBackground}>
      {particles.map((particle, index) => {
        const translateX = particle.progress.interpolate({ inputRange: [0, 1], outputRange: [particle.x, particle.x + particle.dx] });
        const translateY = particle.progress.interpolate({ inputRange: [0, 1], outputRange: [particle.y, particle.y + particle.dy] });
        return (
          <Animated.View
            key={index}
            style={[
              styles.nativeParticle,
              {
                width: particle.size,
                height: particle.size,
                opacity: particle.opacity,
                transform: [{ translateX }, { translateY }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

export function CyberCanvasBackground() {
  const canvasRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !canvasRef.current) return;
    const canvas: any = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.clientWidth || 1200);
    let height = (canvas.height = canvas.clientHeight || 800);

    const particleCount = 45;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 2 + 1,
      alpha: Math.random() * 0.6 + 0.3,
    }));

    let t = 0;
    let animId: number;

    function render() {
      if (!canvas || !ctx) return;
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        width = canvas.width = canvas.clientWidth || 1200;
        height = canvas.height = canvas.clientHeight || 800;
      }

      t += 0.008;

      ctx.fillStyle = '#050A1A';
      ctx.fillRect(0, 0, width, height);

      // Soft glowing ambient orbs matching INBLUE palette
      const orb1X = width * (0.35 + 0.2 * Math.sin(t * 0.5));
      const orb1Y = height * (0.35 + 0.2 * Math.cos(t * 0.3));
      const g1 = ctx.createRadialGradient(orb1X, orb1Y, 0, orb1X, orb1Y, width * 0.55);
      g1.addColorStop(0, 'rgba(0, 163, 255, 0.22)');
      g1.addColorStop(1, 'rgba(5, 10, 26, 0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, width, height);

      const orb2X = width * (0.75 - 0.2 * Math.cos(t * 0.4));
      const orb2Y = height * (0.65 - 0.2 * Math.sin(t * 0.6));
      const g2 = ctx.createRadialGradient(orb2X, orb2Y, 0, orb2X, orb2Y, width * 0.45);
      g2.addColorStop(0, 'rgba(99, 102, 241, 0.18)');
      g2.addColorStop(1, 'rgba(5, 10, 26, 0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, width, height);

      // Constellation lines
      for (let i = 0; i < particleCount; i++) {
        for (let j = i + 1; j < particleCount; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            const lineAlpha = (1 - dist / 140) * 0.22;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(152, 203, 255, ${lineAlpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // Particles
      for (let p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(152, 203, 255, ${p.alpha})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    }

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <canvas
          ref={canvasRef as any}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,10,26,0.35)' }]} />
      </View>
    );
  }

  return <NativeCyberBackground />;
}

const styles = StyleSheet.create({
  nativeBackground: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#050A1A',
  },
  nativeParticle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#98CBFF',
  },
});
