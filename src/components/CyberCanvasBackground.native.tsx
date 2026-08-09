import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Line, RadialGradient, Rect, Stop } from 'react-native-svg';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
};

type Scene = {
  particles: Particle[];
  orb1X: number;
  orb1Y: number;
  orb2X: number;
  orb2Y: number;
};

const PARTICLE_COUNT = 45;
const CONNECTION_DISTANCE = 140;

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

function buildScene(width: number, height: number, particles: Particle[], t: number): Scene {
  return {
    particles: particles.map(particle => ({ ...particle })),
    orb1X: width * (0.35 + 0.2 * Math.sin(t * 0.5)),
    orb1Y: height * (0.35 + 0.2 * Math.cos(t * 0.3)),
    orb2X: width * (0.75 - 0.2 * Math.cos(t * 0.4)),
    orb2Y: height * (0.65 - 0.2 * Math.sin(t * 0.6)),
  };
}

export function CyberCanvasBackground() {
  const { width, height } = useWindowDimensions();
  const viewWidth = Math.max(width, 1);
  const viewHeight = Math.max(height, 1);
  const particlesRef = useRef<Particle[]>(createParticles(viewWidth, viewHeight));
  const timeRef = useRef(0);
  const lastFrameRef = useRef(Date.now());
  const [scene, setScene] = useState(() => buildScene(viewWidth, viewHeight, particlesRef.current, 0));

  useEffect(() => {
    particlesRef.current = createParticles(viewWidth, viewHeight);
    timeRef.current = 0;
    setScene(buildScene(viewWidth, viewHeight, particlesRef.current, 0));
  }, [viewHeight, viewWidth]);

  useEffect(() => {
    lastFrameRef.current = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const frameScale = Math.min((now - lastFrameRef.current) / (1000 / 60), 4);
      lastFrameRef.current = now;
      const particles = particlesRef.current;

      timeRef.current += 0.008 * frameScale;
      for (const particle of particles) {
        particle.x += particle.vx * frameScale;
        particle.y += particle.vy * frameScale;

        if (particle.x < 0 || particle.x > viewWidth) particle.vx *= -1;
        if (particle.y < 0 || particle.y > viewHeight) particle.vy *= -1;
      }

      setScene(buildScene(viewWidth, viewHeight, particles, timeRef.current));
    }, 1000 / 18);

    return () => clearInterval(timer);
  }, [viewHeight, viewWidth]);

  const lines: React.ReactNode[] = [];
  for (let i = 0; i < scene.particles.length; i += 1) {
    for (let j = i + 1; j < scene.particles.length; j += 1) {
      const first = scene.particles[i];
      const second = scene.particles[j];
      const dx = first.x - second.x;
      const dy = first.y - second.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < CONNECTION_DISTANCE) {
        const opacity = (1 - distance / CONNECTION_DISTANCE) * 0.22;
        lines.push(
          <Line
            key={`${i}-${j}`}
            x1={first.x}
            y1={first.y}
            x2={second.x}
            y2={second.y}
            stroke={`rgba(152, 203, 255, ${opacity})`}
            strokeWidth={1}
          />
        );
      }
    }
  }

  return (
    <View pointerEvents="none" style={styles.background}>
      <Svg width={viewWidth} height={viewHeight} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="inblue-cyan-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#00A3FF" stopOpacity={0.22} />
            <Stop offset="100%" stopColor="#050A1A" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="inblue-indigo-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#6366F1" stopOpacity={0.18} />
            <Stop offset="100%" stopColor="#050A1A" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={viewWidth} height={viewHeight} fill="#050A1A" />
        <Circle cx={scene.orb1X} cy={scene.orb1Y} r={viewWidth * 0.55} fill="url(#inblue-cyan-glow)" />
        <Circle cx={scene.orb2X} cy={scene.orb2Y} r={viewWidth * 0.45} fill="url(#inblue-indigo-glow)" />
        {lines}
        {scene.particles.map((particle, index) => (
          <Circle
            key={index}
            cx={particle.x}
            cy={particle.y}
            r={particle.radius}
            fill="#98CBFF"
            fillOpacity={particle.alpha}
          />
        ))}
      </Svg>
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
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 10, 26, 0.35)',
  },
});
