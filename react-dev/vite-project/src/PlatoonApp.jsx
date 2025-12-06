import { Play, Pause, RotateCcw, Settings, Info, Zap, ChevronDown, ChevronUp, HelpCircle, TrendingUp, Activity, Radio, CloudRain, Cloud, Sun, Gauge, Fuel, AlertTriangle, Keyboard, Users, FastForward, Map } from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// Constants
const MAX_VEHICLE_COUNT = 10;
const MIN_VEHICLE_COUNT = 2;
const LEADER_BASE_POSITION = 650;
const MAX_SPEED = 30; // m/s (108 km/h)
const MIN_SPEED = 0;
const PIXELS_PER_METER = 10;
const HISTORY_LENGTH = 200;

// CACC Parameters
const MIN_SPACING = 5;
const DEFAULT_TIME_HEADWAY = 1.2;
const VEHICLE_TIME_CONSTANT = 0.3;
const DT = 1/60;

const COLLISION_THRESHOLD = 3;
const FUEL_IDLE_RATE = 0.5;
const FUEL_ACCEL_FACTOR = 0.15;

// Weather effects
const WEATHER_EFFECTS = {
  clear: { friction: 1.0, visibility: 1.0, brakeEfficiency: 1.0 },
  rain: { friction: 0.7, visibility: 0.7, brakeEfficiency: 0.75 },
  fog: { friction: 0.9, visibility: 0.4, brakeEfficiency: 0.9 },
  storm: { friction: 0.5, visibility: 0.5, brakeEfficiency: 0.6 }
};

// Scenario presets
const SCENARIOS = {
  normal: { name: "Normal Cruising", description: "Steady highway driving", targetSpeed: 20, tau: 1.2, kp: 0.4, kd: 0.8, eventSequence: [] },
  aggressive: { name: "Aggressive Following", description: "Short time headway", targetSpeed: 25, tau: 0.6, kp: 0.6, kd: 0.7, eventSequence: [] },
  stopAndGo: { name: "Stop & Go Traffic", description: "Traffic congestion", targetSpeed: 15, tau: 1.5, kp: 0.5, kd: 0.9, eventSequence: [{ time: 2, action: 'speed', value: 5 }, { time: 5, action: 'speed', value: 15 }, { time: 8, action: 'speed', value: 0 }, { time: 11, action: 'speed', value: 20 }] },
  emergencyBraking: { name: "Emergency Braking", description: "Sudden deceleration", targetSpeed: 25, tau: 1.0, kp: 0.5, kd: 1.0, eventSequence: [{ time: 3, action: 'brake', value: true }, { time: 6, action: 'brake', value: false }, { time: 8, action: 'speed', value: 25 }] },
  conservative: { name: "Conservative", description: "Large time headway", targetSpeed: 20, tau: 2.0, kp: 0.3, kd: 1.0, eventSequence: [] },
  highSpeed: { name: "High Speed", description: "100+ km/h driving", targetSpeed: 28, tau: 1.5, kp: 0.5, kd: 1.2, eventSequence: [] }
};

const VEHICLE_TYPES = [
  { name: 'sedan', length: 4.5, color: '#3b82f6', maxAccel: 3.0, fuelEfficiency: 1.0 },
  { name: 'suv', length: 5.0, color: '#ef4444', maxAccel: 2.5, fuelEfficiency: 1.3 },
  { name: 'truck', length: 6.0, color: '#f97316', maxAccel: 2.0, fuelEfficiency: 1.8 },
  { name: 'sports', length: 4.2, color: '#a855f7', maxAccel: 4.0, fuelEfficiency: 1.5 },
  { name: 'electric', length: 4.6, color: '#22c55e', maxAccel: 3.5, fuelEfficiency: 0.3 },
  { name: 'compact', length: 3.8, color: '#06b6d4', maxAccel: 2.8, fuelEfficiency: 0.8 },
];

const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4];

// Initialize vehicles
const initializeVehicles = (count) => {
  return Array(count).fill(0).map((_, i) => ({
    id: i,
    position: 0,
    velocity: 0,
    acceleration: 0,
    desiredAcceleration: 0,
    color: VEHICLE_TYPES[i % VEHICLE_TYPES.length].color,
    isLeader: i === count - 1,
    type: VEHICLE_TYPES[i % VEHICLE_TYPES.length],
    controlInput: 0,
    spacingError: 0,
    velocityError: 0,
    fuelConsumed: 0,
    communicating: false,
    lastCommTime: 0,
    exhaustParticles: [],
    sparkParticles: []
  }));
};

// Generate scenery
const generateScenery = () => {
  const elements = [];
  let id = 0;

  // Stars (for night mode)
  for (let i = 0; i < 100; i++) {
    elements.push({
      id: id++,
      x: Math.random() * 1200,
      y: Math.random() * 150,
      type: 'star',
      scale: 0.5 + Math.random() * 1,
      twinkleOffset: Math.random() * Math.PI * 2
    });
  }

  // Clouds
  for (let x = 0; x < 4000; x += 200 + Math.random() * 150) {
    elements.push({ id: id++, x, y: 30 + Math.random() * 80, type: 'cloud', scale: 0.6 + Math.random() * 0.6, speed: 0.1 + Math.random() * 0.1 });
  }

  // Birds
  for (let i = 0; i < 8; i++) {
    elements.push({
      id: id++,
      x: Math.random() * 2000,
      y: 50 + Math.random() * 100,
      type: 'bird',
      scale: 0.3 + Math.random() * 0.3,
      speed: 2 + Math.random() * 2,
      flapOffset: Math.random() * Math.PI * 2
    });
  }

  // Planes
  for (let i = 0; i < 2; i++) {
    elements.push({
      id: id++,
      x: Math.random() * 3000,
      y: 40 + Math.random() * 60,
      type: 'plane',
      scale: 0.4,
      speed: 0.5 + Math.random() * 0.3
    });
  }

  // Trees
  for (let x = 0; x < 3000; x += 60 + Math.random() * 40) {
    elements.push({ id: id++, x, y: -50 - Math.random() * 20, type: Math.random() > 0.5 ? 'tree' : 'pine', scale: 0.6 + Math.random() * 0.4, swayOffset: Math.random() * Math.PI * 2 });
  }

  // Buildings
  for (let x = 100; x < 3000; x += 200 + Math.random() * 100) {
    elements.push({ id: id++, x, y: -120, type: 'building', scale: 0.8 + Math.random() * 0.4, height: 60 + Math.random() * 40 });
  }

  // Road signs
  for (let x = 200; x < 3000; x += 400) {
    elements.push({ id: id++, x, y: -30, type: 'sign', scale: 1 });
  }

  // Mountains
  for (let x = 0; x < 4000; x += 300) {
    elements.push({ id: id++, x, y: -200, type: 'mountain', scale: 1 + Math.random() * 0.5, height: 100 + Math.random() * 50 });
  }

  return elements;
};

// Animated Star Component
const Star = ({ x, y, scale, twinkleOffset, time, isDarkMode }) => {
  if (!isDarkMode) return null;
  const twinkle = 0.3 + Math.sin(time * 3 + twinkleOffset) * 0.7;
  return (
    <circle cx={x} cy={y} r={scale} fill="#fff" opacity={twinkle}>
      <animate attributeName="opacity" values={`${twinkle};${twinkle * 0.3};${twinkle}`} dur="2s" repeatCount="indefinite" />
    </circle>
  );
};

// Shooting Star Component
const ShootingStar = ({ isDarkMode, time }) => {
  if (!isDarkMode) return null;
  const cycle = (time * 0.1) % 15;
  if (cycle > 1) return null;

  const startX = 200 + (time * 50) % 800;
  const startY = 20 + (time * 10) % 80;

  return (
    <g>
      <defs>
        <linearGradient id="shootingStarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="100%" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
      </defs>
      <line
        x1={startX - 60}
        y1={startY + 30}
        x2={startX}
        y2={startY}
        stroke="url(#shootingStarGrad)"
        strokeWidth="2"
        opacity={1 - cycle}
      />
      <circle cx={startX} cy={startY} r="2" fill="#fff" opacity={1 - cycle} />
    </g>
  );
};

// Animated Bird Component
const Bird = ({ x, y, scale, flapOffset, time }) => {
  const flap = Math.sin(time * 10 + flapOffset) * 8;
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      <path
        d={`M 0,0 Q -8,${flap} -15,${flap/2} M 0,0 Q 8,${flap} 15,${flap/2}`}
        fill="none"
        stroke="#1f2937"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  );
};

// Animated Plane Component
const Plane = ({ x, y, scale }) => (
  <g transform={`translate(${x}, ${y}) scale(${scale})`}>
    <ellipse cx="0" cy="0" rx="20" ry="4" fill="#9ca3af" />
    <polygon points="-5,-8 5,-8 0,0" fill="#9ca3af" />
    <polygon points="-15,0 -25,-3 -25,3" fill="#6b7280" />
    <circle cx="15" cy="0" r="2" fill="#60a5fa" />
    {/* Contrail */}
    <line x1="-25" y1="0" x2="-80" y2="0" stroke="#fff" strokeWidth="2" opacity="0.3">
      <animate attributeName="x2" values="-80;-120;-80" dur="2s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
    </line>
  </g>
);

// Enhanced Cloud with animation
const CloudShape = ({ x, y, scale, isDarkMode }) => (
  <g transform={`translate(${x}, ${y}) scale(${scale})`} opacity="0.8">
    <ellipse cx="0" cy="0" rx="25" ry="12" fill={isDarkMode ? "#4b5563" : "#fff"}>
      <animate attributeName="ry" values="12;14;12" dur="4s" repeatCount="indefinite" />
    </ellipse>
    <ellipse cx="-15" cy="2" rx="18" ry="10" fill={isDarkMode ? "#4b5563" : "#fff"} />
    <ellipse cx="15" cy="3" rx="20" ry="11" fill={isDarkMode ? "#4b5563" : "#fff"} />
    <ellipse cx="0" cy="-5" rx="15" ry="8" fill={isDarkMode ? "#6b7280" : "#f8fafc"} opacity="0.8" />
  </g>
);

// Mountain with snow cap animation
const Mountain = ({ x, y, scale, height, isDarkMode }) => (
  <g transform={`translate(${x}, ${y}) scale(${scale})`}>
    <polygon points={`0,0 ${height/2},${-height} ${height},0`} fill={isDarkMode ? "#1e293b" : "#64748b"} opacity="0.4" />
    <polygon points={`${height/2},${-height} ${height*0.55},${-height*0.8} ${height*0.65},${-height*0.75}`} fill="#fff" opacity="0.9">
      <animate attributeName="opacity" values="0.9;0.7;0.9" dur="3s" repeatCount="indefinite" />
    </polygon>
  </g>
);

// Tree with wind sway
const Tree = ({ x, y, scale, isDarkMode, swayOffset, time }) => {
  const sway = Math.sin(time * 2 + swayOffset) * 2;
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale}) skewX(${sway})`}>
      <ellipse cx="0" cy="-25" rx="18" ry="25" fill={isDarkMode ? "#2d5016" : "#4a7c2e"} opacity="0.9" />
      <ellipse cx="-8" cy="-30" rx="15" ry="20" fill={isDarkMode ? "#3a6320" : "#5a9438"} opacity="0.8" />
      <ellipse cx="8" cy="-28" rx="13" ry="18" fill={isDarkMode ? "#3a6320" : "#5a9438"} opacity="0.8" />
      <rect x="-4" y="-10" width="8" height="20" fill="#5d4037" rx="2" />
    </g>
  );
};

// Pine tree with sway
const PineTree = ({ x, y, scale, isDarkMode, swayOffset, time }) => {
  const sway = Math.sin(time * 1.5 + swayOffset) * 1.5;
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale}) skewX(${sway})`}>
      <polygon points="0,-40 -12,-20 12,-20" fill={isDarkMode ? "#2d5016" : "#4a7c2e"} />
      <polygon points="0,-30 -14,-10 14,-10" fill={isDarkMode ? "#2d5016" : "#4a7c2e"} />
      <polygon points="0,-20 -16,0 16,0" fill={isDarkMode ? "#3a6320" : "#5a9438"} />
      <rect x="-3" y="0" width="6" height="15" fill="#5d4037" />
    </g>
  );
};

// Building with animated windows
const Building = ({ x, y, scale, height, isDarkMode, time }) => {
  const windowRows = Math.floor(height / 15);
  const windows = [];
  for (let row = 0; row < windowRows; row++) {
    for (let col = 0; col < 3; col++) {
      const isLit = isDarkMode && Math.sin(time + row * 0.5 + col * 0.3) > 0.3;
      windows.push(
        <rect key={`${row}-${col}`} x={-25 + col * 18} y={-height + 10 + row * 15} width="10" height="10"
          fill={isLit ? "#fbbf24" : isDarkMode ? "#374151" : "#cbd5e0"} opacity={isLit ? 0.9 : 0.6}>
          {isLit && <animate attributeName="opacity" values="0.9;0.7;0.9" dur={`${1 + Math.random()}s`} repeatCount="indefinite" />}
        </rect>
      );
    }
  }
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      <rect x="-30" y={-height} width="60" height={height} fill={isDarkMode ? "#2d3748" : "#4a5568"} opacity="0.7" />
      {windows}
      <rect x="-30" y={-height} width="60" height="3" fill={isDarkMode ? "#4b5563" : "#6b7280"} />
    </g>
  );
};

// Road Sign with glow
const RoadSign = ({ x, y, isDarkMode }) => (
  <g transform={`translate(${x}, ${y})`}>
    <rect x="-2" y="-5" width="4" height="35" fill={isDarkMode ? "#718096" : "#4a5568"} />
    {isDarkMode && <circle cx="0" cy="-15" r="18" fill="#3b82f6" opacity="0.2">
      <animate attributeName="r" values="18;22;18" dur="2s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.2;0.1;0.2" dur="2s" repeatCount="indefinite" />
    </circle>}
    <circle cx="0" cy="-15" r="12" fill="#3b82f6" stroke="#fff" strokeWidth="2" />
    <text x="0" y="-10" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold">V</text>
  </g>
);

// Enhanced Rain with splash effects
const RainEffect = ({ intensity }) => {
  const drops = useMemo(() => {
    const d = [];
    for (let i = 0; i < intensity * 80; i++) {
      d.push({
        x: Math.random() * 1200,
        delay: Math.random() * 2,
        speed: 0.3 + Math.random() * 0.4
      });
    }
    return d;
  }, [intensity]);

  return (
    <g className="rain-effect">
      {drops.map((drop, i) => (
        <g key={i}>
          <line
            x1={drop.x} y1={-20} x2={drop.x + 5} y2={0}
            stroke="#60a5fa" strokeWidth="1.5" opacity="0.4"
          >
            <animate attributeName="y1" from="-20" to="400" dur={`${drop.speed}s`} repeatCount="indefinite" begin={`${drop.delay}s`} />
            <animate attributeName="y2" from="0" to="420" dur={`${drop.speed}s`} repeatCount="indefinite" begin={`${drop.delay}s`} />
          </line>
        </g>
      ))}
      {/* Splash effects on road */}
      {Array.from({ length: 15 }, (_, i) => (
        <circle key={`splash-${i}`} cx={80 * i + Math.random() * 40} cy="380" r="0" fill="#60a5fa" opacity="0.3">
          <animate attributeName="r" values="0;8;0" dur="0.8s" repeatCount="indefinite" begin={`${Math.random() * 2}s`} />
          <animate attributeName="opacity" values="0.3;0;0.3" dur="0.8s" repeatCount="indefinite" begin={`${Math.random() * 2}s`} />
        </circle>
      ))}
    </g>
  );
};

// Enhanced Fog with layers
const FogEffect = ({ intensity }) => (
  <g>
    <rect x="0" y="0" width="1200" height="400" fill="#e5e7eb" opacity={intensity * 0.4} />
    {[0, 80, 160, 240, 320].map((y, i) => (
      <ellipse key={y} cx="600" cy={y} rx="900" ry="50" fill="#f3f4f6" opacity={intensity * 0.3}>
        <animate attributeName="cx" values={`600;${650 + i * 10};600;${550 - i * 10};600`} dur={`${8 + i * 2}s`} repeatCount="indefinite" />
      </ellipse>
    ))}
  </g>
);

// Exhaust Particle System
const ExhaustParticles = ({ x, velocity, isBraking }) => {
  if (velocity < 5) return null;
  const particleCount = Math.min(Math.floor(velocity / 3), 8);

  return (
    <g>
      {Array.from({ length: particleCount }, (_, i) => (
        <circle key={i} r="0" fill={isBraking ? "#ef4444" : "#9ca3af"} opacity="0.6">
          <animate attributeName="cx" from={x - 35} to={x - 35 - 40 - i * 5} dur="0.5s" repeatCount="indefinite" begin={`${i * 0.1}s`} />
          <animate attributeName="cy" from="0" to={-5 + Math.random() * 10} dur="0.5s" repeatCount="indefinite" begin={`${i * 0.1}s`} />
          <animate attributeName="r" values="2;4;0" dur="0.5s" repeatCount="indefinite" begin={`${i * 0.1}s`} />
          <animate attributeName="opacity" values="0.6;0.3;0" dur="0.5s" repeatCount="indefinite" begin={`${i * 0.1}s`} />
        </circle>
      ))}
    </g>
  );
};

// Spark Effect for braking
const SparkEffect = ({ x, isBraking }) => {
  if (!isBraking) return null;

  return (
    <g>
      {Array.from({ length: 6 }, (_, i) => (
        <circle key={i} r="1" fill="#fbbf24">
          <animate attributeName="cx" from={x - 20 + Math.random() * 10} to={x - 40 + Math.random() * 20} dur="0.3s" repeatCount="indefinite" begin={`${i * 0.05}s`} />
          <animate attributeName="cy" from="15" to={10 + Math.random() * 15} dur="0.3s" repeatCount="indefinite" begin={`${i * 0.05}s`} />
          <animate attributeName="opacity" values="1;0" dur="0.3s" repeatCount="indefinite" begin={`${i * 0.05}s`} />
        </circle>
      ))}
    </g>
  );
};

// V2V Communication with enhanced visuals
const V2VCommunication = ({ vehicles, cameraOffset, showV2V }) => {
  if (!showV2V || vehicles.length < 2) return null;

  return (
    <g>
      {vehicles.slice(0, -1).map((vehicle, index) => {
        const nextVehicle = vehicles[index + 1];
        const x1 = (vehicle.position - cameraOffset) * PIXELS_PER_METER + 600;
        const x2 = (nextVehicle.position - cameraOffset) * PIXELS_PER_METER + 600;
        const midX = (x1 + x2) / 2;

        return (
          <g key={`v2v-${vehicle.id}`}>
            {/* Glow effect */}
            <path d={`M ${x1} -30 Q ${midX} -70 ${x2} -30`} fill="none" stroke="#22d3ee" strokeWidth="8" opacity="0.1" filter="url(#glow)" />

            {/* Main arc */}
            <path d={`M ${x1} -30 Q ${midX} -70 ${x2} -30`} fill="none" stroke="#22d3ee" strokeWidth="2" strokeDasharray="8,4" opacity="0.7">
              <animate attributeName="stroke-dashoffset" from="0" to="24" dur="1s" repeatCount="indefinite" />
            </path>

            {/* Pulse at endpoints */}
            <circle cx={x1} cy="-30" r="4" fill="#22d3ee">
              <animate attributeName="r" values="4;8;4" dur="1s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.9;0.3;0.9" dur="1s" repeatCount="indefinite" />
            </circle>
            <circle cx={x2} cy="-30" r="4" fill="#22d3ee">
              <animate attributeName="r" values="4;8;4" dur="1s" repeatCount="indefinite" begin="0.5s" />
              <animate attributeName="opacity" values="0.9;0.3;0.9" dur="1s" repeatCount="indefinite" begin="0.5s" />
            </circle>

            {/* Data packets */}
            {[0, 0.33, 0.66].map((delay, i) => (
              <circle key={i} r="3" fill="#22d3ee" opacity="0.8">
                <animateMotion path={`M ${x1 - 600} -30 Q ${midX - 600} -70 ${x2 - 600} -30`} dur="0.8s" repeatCount="indefinite" begin={`${delay}s`} />
              </circle>
            ))}

            {/* Signal icon */}
            <g transform={`translate(${midX}, -65)`}>
              <circle r="12" fill="#0e7490" opacity="0.9" />
              <circle r="16" fill="#0e7490" opacity="0">
                <animate attributeName="r" values="12;20;12" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
              </circle>
              <path d="M -4,-2 L 0,-6 L 4,-2 M -6,2 L 0,-4 L 6,2 M -8,6 L 0,-2 L 8,6" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
            </g>
          </g>
        );
      })}
    </g>
  );
};

// Collision Warning
const CollisionWarning = ({ vehicles, isDarkMode }) => {
  const collisions = [];
  for (let i = 0; i < vehicles.length - 1; i++) {
    const spacing = vehicles[i + 1].position - vehicles[i].position;
    if (spacing < COLLISION_THRESHOLD) {
      collisions.push({ vehicle1: i, vehicle2: i + 1, spacing, severity: spacing < 1 ? 'critical' : 'warning' });
    }
  }
  if (collisions.length === 0) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 ${isDarkMode ? 'bg-red-900/90' : 'bg-red-100'} border-2 border-red-500 rounded-xl p-4 shadow-2xl backdrop-blur-sm`}>
      <div className="flex items-center gap-2 text-red-500 font-bold animate-pulse">
        <AlertTriangle size={24} />
        <span>COLLISION WARNING</span>
      </div>
      {collisions.map((c, i) => (
        <div key={i} className={`text-sm mt-2 ${c.severity === 'critical' ? 'text-red-400 font-bold' : 'text-orange-400'}`}>
          V{c.vehicle1 + 1} ↔ V{c.vehicle2 + 1}: {c.spacing.toFixed(1)}m {c.severity === 'critical' && '⚠️'}
        </div>
      ))}
    </div>
  );
};

// Mini-map
const MiniMap = ({ vehicles, isDarkMode, cameraOffset }) => {
  if (vehicles.length === 0) return null;
  const minPos = Math.min(...vehicles.map(v => v.position)) - 20;
  const maxPos = Math.max(...vehicles.map(v => v.position)) + 20;
  const range = maxPos - minPos;
  const scale = 180 / Math.max(range, 100);

  return (
    <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-600' : 'bg-white/90 border-gray-300'} border rounded-lg p-2 shadow-lg backdrop-blur-sm`}>
      <div className="text-xs font-semibold mb-1 flex items-center gap-1">
        <Map size={12} /> Overview
      </div>
      <svg width="200" height="40" className="rounded">
        <rect width="200" height="40" fill={isDarkMode ? '#374151' : '#f3f4f6'} />
        <rect x="0" y="15" width="200" height="10" fill={isDarkMode ? '#1f2937' : '#4b5563'} rx="2" />
        <rect x={10 + ((cameraOffset - minPos) * scale) - 30} y="0" width="60" height="40" fill="#3b82f6" opacity="0.2" rx="4" />
        {vehicles.map((vehicle) => {
          const x = 10 + (vehicle.position - minPos) * scale;
          return (
            <g key={vehicle.id}>
              <rect x={x - 4} y="17" width="8" height="6" fill={vehicle.color} rx="1">
                {vehicle.velocity > 15 && (
                  <animate attributeName="opacity" values="1;0.7;1" dur="0.5s" repeatCount="indefinite" />
                )}
              </rect>
              {vehicle.isLeader && <circle cx={x} cy="12" r="3" fill="#fbbf24" />}
            </g>
          );
        })}
        <text x="180" y="38" textAnchor="end" fill={isDarkMode ? '#9ca3af' : '#6b7280'} fontSize="8">{range.toFixed(0)}m</text>
      </svg>
    </div>
  );
};

// Enhanced Vehicle Component
const VehicleComponent = ({ vehicle, isDarkMode, pixelX, showDetails, showSpacingLine, nextVehicle, weather, time }) => {
  const isAccelerating = vehicle.acceleration > 0.5;
  const isBraking = vehicle.acceleration < -0.5;
  const weatherEffect = WEATHER_EFFECTS[weather];
  const glowId = `glow-${vehicle.id}`;
  const gradId = `vehicle-grad-${vehicle.id}`;
  const headlightId = `headlight-${vehicle.id}`;

  return (
    <g>
      {/* Spacing line */}
      {showSpacingLine && nextVehicle && (
        <g>
          <line x1={pixelX} y1="-10" x2={(nextVehicle.position - vehicle.position) * PIXELS_PER_METER + pixelX} y2="-10"
            stroke={vehicle.spacingStatus === 'optimal' ? '#10b981' : vehicle.spacingStatus === 'close' ? '#ef4444' : '#3b82f6'}
            strokeWidth="3" strokeDasharray="8,4" opacity="0.6">
            <animate attributeName="stroke-dashoffset" from="0" to="24" dur="1s" repeatCount="indefinite" />
          </line>
          <text x={pixelX + (nextVehicle.position - vehicle.position) * PIXELS_PER_METER / 2} y="-18"
            textAnchor="middle" fill={isDarkMode ? '#fff' : '#1f2937'} fontSize="11" fontWeight="600">
            {(nextVehicle.position - vehicle.position).toFixed(1)}m
          </text>
        </g>
      )}

      <g transform={`translate(${pixelX}, 0)`}>
        {/* Definitions */}
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={vehicle.color} stopOpacity="1" />
            <stop offset="40%" stopColor={vehicle.color} stopOpacity="0.9" />
            <stop offset="100%" stopColor={vehicle.color} stopOpacity="0.5" />
          </linearGradient>
          <radialGradient id={headlightId}>
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="50%" stopColor="#fef08a" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Shadow with blur */}
        <ellipse cx="0" cy="26" rx="38" ry="8" fill="#000" opacity="0.25" filter="blur(2px)" />

        {/* Wet reflection */}
        {(weather === 'rain' || weather === 'storm') && (
          <ellipse cx="0" cy="30" rx="32" ry="6" fill={vehicle.color} opacity="0.15">
            <animate attributeName="opacity" values="0.15;0.08;0.15" dur="1s" repeatCount="indefinite" />
          </ellipse>
        )}

        {/* Exhaust particles */}
        <ExhaustParticles x={0} velocity={vehicle.velocity} isBraking={isBraking} />

        {/* Brake sparks */}
        <SparkEffect x={0} isBraking={isBraking} />

        {/* Speed lines */}
        {vehicle.velocity > 15 && (
          <g opacity={Math.min(vehicle.velocity / 30, 0.6)}>
            {[-5, -2, 1, 4].map((offset, i) => (
              <line key={offset} x1={-50 - i * 3} y1={offset} x2={-35 - i * 5} y2={offset}
                stroke={isDarkMode ? '#60a5fa' : '#3b82f6'} strokeWidth="2" strokeLinecap="round">
                <animate attributeName="opacity" values="0.6;0.2;0.6" dur="0.3s" repeatCount="indefinite" begin={`${i * 0.1}s`} />
              </line>
            ))}
          </g>
        )}

        {/* Headlight beams */}
        {(weatherEffect.visibility < 0.8 || isDarkMode) && (
          <ellipse cx="55" cy="0" rx="60" ry="20" fill={`url(#${headlightId})`} opacity={weatherEffect.visibility < 0.6 ? 0.5 : 0.3}>
            <animate attributeName="rx" values="60;65;60" dur="2s" repeatCount="indefinite" />
          </ellipse>
        )}

        {/* Main body */}
        <rect x="-32" y="-13" width="64" height="26" fill={`url(#${gradId})`} rx="8" />
        <rect x="-28" y="-11" width="56" height="4" fill="#fff" opacity="0.35" rx="2" />

        {/* Roof */}
        <path d="M -16,-13 L -11,-24 L 11,-24 L 16,-13 Z" fill={vehicle.color} opacity="0.95" />
        <path d="M -14,-13 L -10,-22 L 10,-22 L 14,-13 Z" fill={vehicle.color} />

        {/* Windows with animated reflection */}
        <rect x="-13" y="-21" width="11" height="9" fill={isDarkMode ? "#1e293b" : "#dbeafe"} rx="2" opacity="0.95" />
        <rect x="2" y="-21" width="11" height="9" fill={isDarkMode ? "#1e293b" : "#dbeafe"} rx="2" opacity="0.95" />
        <rect x="-12" y="-20" width="3" height="7" fill="#fff" opacity="0.4" rx="1">
          <animate attributeName="opacity" values="0.4;0.2;0.4" dur="3s" repeatCount="indefinite" />
        </rect>
        <rect x="3" y="-20" width="3" height="7" fill="#fff" opacity="0.4" rx="1">
          <animate attributeName="opacity" values="0.4;0.2;0.4" dur="3s" repeatCount="indefinite" begin="1.5s" />
        </rect>

        {/* Wheels with rotation */}
        <g>
          <circle cx="-18" cy="13" r="8" fill="#1a1a1a" />
          <circle cx="-18" cy="13" r="5" fill="#3f3f46">
            <animateTransform attributeName="transform" type="rotate" from="0 -18 13" to="360 -18 13"
              dur={vehicle.velocity > 1 ? `${1 / (vehicle.velocity / 10)}s` : '100s'} repeatCount="indefinite" />
          </circle>
          <circle cx="-18" cy="13" r="2" fill="#71717a" />

          <circle cx="18" cy="13" r="8" fill="#1a1a1a" />
          <circle cx="18" cy="13" r="5" fill="#3f3f46">
            <animateTransform attributeName="transform" type="rotate" from="0 18 13" to="360 18 13"
              dur={vehicle.velocity > 1 ? `${1 / (vehicle.velocity / 10)}s` : '100s'} repeatCount="indefinite" />
          </circle>
          <circle cx="18" cy="13" r="2" fill="#71717a" />
        </g>

        {/* Headlights */}
        <circle cx="31" cy="-6" r="4" fill={(isAccelerating || weatherEffect.visibility < 0.8) ? "#fef08a" : "#fef9c3"}
          opacity={(isAccelerating || weatherEffect.visibility < 0.8 || isDarkMode) ? 1 : 0.6}
          filter={(isAccelerating || isDarkMode) ? `url(#${glowId})` : ''} />
        <circle cx="31" cy="6" r="4" fill={(isAccelerating || weatherEffect.visibility < 0.8) ? "#fef08a" : "#fef9c3"}
          opacity={(isAccelerating || weatherEffect.visibility < 0.8 || isDarkMode) ? 1 : 0.6}
          filter={(isAccelerating || isDarkMode) ? `url(#${glowId})` : ''} />

        {/* Brake lights */}
        <rect x="-33" y="-8" width="4" height="6" fill={isBraking ? "#ef4444" : "#7f1d1d"} rx="1"
          opacity={isBraking ? 1 : 0.4} filter={isBraking ? `url(#${glowId})` : ''} />
        <rect x="-33" y="2" width="4" height="6" fill={isBraking ? "#ef4444" : "#7f1d1d"} rx="1"
          opacity={isBraking ? 1 : 0.4} filter={isBraking ? `url(#${glowId})` : ''} />
        {isBraking && (
          <rect x="-36" y="-10" width="2" height="20" fill="#ef4444" opacity="0.4" rx="1">
            <animate attributeName="opacity" values="0.4;0.2;0.4" dur="0.2s" repeatCount="indefinite" />
          </rect>
        )}

        {/* Leader badge */}
        {vehicle.isLeader && (
          <g transform="translate(0, -40)">
            <rect x="-26" y="-14" width="52" height="22" fill="url(#leaderGrad)" rx="6" stroke="#f59e0b" strokeWidth="2" />
            <text x="0" y="2" textAnchor="middle" fill="#1f2937" fontSize="11" fontWeight="bold">👑 LEADER</text>
            <circle cx="-18" cy="-3" r="2" fill="#f59e0b" opacity="0.8">
              <animate attributeName="r" values="2;3;2" dur="1s" repeatCount="indefinite" />
            </circle>
            <circle cx="18" cy="-3" r="2" fill="#f59e0b" opacity="0.8">
              <animate attributeName="r" values="2;3;2" dur="1s" repeatCount="indefinite" begin="0.5s" />
            </circle>
          </g>
        )}

        {/* Velocity display */}
        {showDetails && (
          <g transform="translate(0, 40)">
            <rect x="-30" y="0" width="60" height="20" fill={isDarkMode ? "#1f2937" : "#fff"} rx="6" opacity="0.95"
              stroke={isDarkMode ? "#4b5563" : "#d1d5db"} strokeWidth="1" />
            <text x="0" y="14" textAnchor="middle" fill={isDarkMode ? '#fff' : '#1f2937'} fontSize="12" fontWeight="700">
              {vehicle.velocity.toFixed(1)} m/s
            </text>
          </g>
        )}

        {/* Status indicator */}
        {!vehicle.isLeader && showDetails && (
          <g>
            <circle cx="0" cy="-32" r="7"
              fill={vehicle.spacingStatus === 'optimal' ? '#10b981' : vehicle.spacingStatus === 'close' ? '#ef4444' : '#3b82f6'}
              opacity="0.95" filter={vehicle.spacingStatus === 'close' ? `url(#${glowId})` : ''} />
            {vehicle.spacingStatus === 'close' && (
              <circle cx="0" cy="-32" r="7" fill="#ef4444" opacity="0">
                <animate attributeName="r" values="7;14;7" dur="0.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0;0.5" dur="0.8s" repeatCount="indefinite" />
              </circle>
            )}
          </g>
        )}

        {/* Vehicle ID */}
        {showDetails && (
          <text x="0" y="-50" textAnchor="middle" fill={isDarkMode ? '#9ca3af' : '#6b7280'} fontSize="10" fontWeight="600">
            #{vehicle.id + 1}
          </text>
        )}
      </g>
    </g>
  );
};

// Chart Component
const RealtimeChart = ({ title, data, yLabel, isDarkMode, colors, maxY }) => {
  if (data.length < 2) return null;
  const width = 380, height = 140;
  const padding = { top: 25, right: 10, bottom: 25, left: 45 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const dataMax = maxY || Math.max(...data.map(d => Math.max(...d.values)), 0.1);
  const yMax = dataMax * 1.1;

  return (
    <svg width={width} height={height} className={`border rounded-lg ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
      <rect width={width} height={height} fill={isDarkMode ? '#1f2937' : '#f9fafb'} rx="8" />
      <text x={width/2} y={16} textAnchor="middle" fill={isDarkMode ? '#e5e7eb' : '#374151'} fontSize="11" fontWeight="600">{title}</text>
      <text x={12} y={height/2} textAnchor="middle" fill={isDarkMode ? '#9ca3af' : '#6b7280'} fontSize="9" transform={`rotate(-90, 12, ${height/2})`}>{yLabel}</text>

      {[0.25, 0.5, 0.75, 1.0].map((frac, i) => (
        <g key={i}>
          <line x1={padding.left} y1={padding.top + chartHeight * (1 - frac)} x2={padding.left + chartWidth} y2={padding.top + chartHeight * (1 - frac)}
            stroke={isDarkMode ? '#374151' : '#e5e7eb'} strokeDasharray="3,3" />
          <text x={padding.left - 4} y={padding.top + chartHeight * (1 - frac) + 3} textAnchor="end" fill={isDarkMode ? '#9ca3af' : '#6b7280'} fontSize="8">
            {(yMax * frac).toFixed(1)}
          </text>
        </g>
      ))}

      {data.length > 0 && data[0].values.map((_, vehicleIdx) => {
        const points = data.map((snapshot, timeIdx) => {
          const x = padding.left + (timeIdx / Math.max(data.length - 1, 1)) * chartWidth;
          const y = padding.top + chartHeight - (snapshot.values[vehicleIdx] / yMax) * chartHeight;
          return `${x},${y}`;
        }).join(' ');
        return <polyline key={vehicleIdx} points={points} fill="none" stroke={colors[vehicleIdx]} strokeWidth="2" opacity="0.85" />;
      })}
    </svg>
  );
};

// String Stability
const StringStabilityIndicator = ({ vehicles, isDarkMode }) => {
  if (vehicles.length < 3) return null;
  const velocities = vehicles.slice(0, -1).map(v => v.velocity);
  const avgVel = velocities.reduce((a, b) => a + b, 0) / velocities.length;
  const variance = velocities.reduce((sum, v) => sum + Math.pow(v - avgVel, 2), 0) / velocities.length;
  const stabilityScore = Math.max(0, 100 - variance * 20);
  const isStable = stabilityScore > 70;

  return (
    <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
      <h3 className="text-xs font-bold mb-2 flex items-center gap-2"><TrendingUp size={14} /> String Stability</h3>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className={`h-2.5 rounded-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'} overflow-hidden`}>
            <div className={`h-full transition-all duration-300 ${isStable ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-orange-500 to-red-500'}`}
              style={{ width: `${stabilityScore}%` }} />
          </div>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded ${isStable ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {stabilityScore.toFixed(0)}%
        </span>
      </div>
    </div>
  );
};

// Fuel Panel
const FuelEfficiencyPanel = ({ vehicles, simulationTime, isDarkMode }) => {
  if (vehicles.length === 0 || simulationTime < 1) return null;
  const totalFuel = vehicles.reduce((sum, v) => sum + v.fuelConsumed, 0);
  const totalDistance = vehicles.reduce((sum, v) => sum + v.position, 0) / 1000;
  const avgEfficiency = totalDistance > 0.01 ? (totalFuel / totalDistance) * 100 : 0;

  return (
    <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
      <h3 className="text-xs font-bold mb-2 flex items-center gap-2"><Fuel size={14} /> Energy</h3>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><span className="opacity-60">Fuel:</span> <span className="font-bold">{totalFuel.toFixed(2)}L</span></div>
        <div><span className="opacity-60">Eff:</span> <span className="font-bold">{avgEfficiency.toFixed(1)} L/100km</span></div>
      </div>
    </div>
  );
};

// Keyboard Shortcuts Modal
const KeyboardShortcuts = ({ isDarkMode, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
    <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 max-w-md shadow-2xl transform transition-all`} onClick={e => e.stopPropagation()}>
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Keyboard size={20} /> Keyboard Shortcuts</h3>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {[['Space', 'Play/Pause'], ['R', 'Reset'], ['E', 'Emergency'], ['↑↓', 'Speed'], ['←→', 'Headway'], ['1-6', 'Scenarios'],
          ['V', 'V2V'], ['D', 'Details'], ['C', 'Charts'], ['M', 'Map'], ['W', 'Weather'], ['?', 'Help']].map(([key, desc]) => (
          <div key={key} className="flex items-center gap-2">
            <kbd className={`px-2 py-0.5 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} font-mono text-xs`}>{key}</kbd>
            <span className="text-xs">{desc}</span>
          </div>
        ))}
      </div>
      <button onClick={onClose} className={`mt-4 w-full py-2 rounded-lg ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} transition-colors text-sm`}>Close</button>
    </div>
  </div>
);

// Weather Selector
const WeatherSelector = ({ weather, setWeather, isDarkMode }) => (
  <div className="flex gap-1">
    {[{ id: 'clear', icon: Sun }, { id: 'rain', icon: CloudRain }, { id: 'fog', icon: Cloud }, { id: 'storm', icon: CloudRain }].map(({ id, icon: Icon }) => (
      <button key={id} onClick={() => setWeather(id)}
        className={`p-2 rounded-lg transition-all ${weather === id ? 'bg-blue-500 text-white scale-110' : isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}>
        <Icon size={14} />
      </button>
    ))}
  </div>
);

// Main App
const PlatoonApp = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [running, setRunning] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [scenery, setScenery] = useState([]);
  const [cameraOffset, setCameraOffset] = useState(0);
  const [simulationTime, setSimulationTime] = useState(0);
  const [animationTime, setAnimationTime] = useState(0);

  const [timeHeadway, setTimeHeadway] = useState(DEFAULT_TIME_HEADWAY);
  const [targetSpeed, setTargetSpeed] = useState(20);
  const [kp, setKp] = useState(0.4);
  const [kd, setKd] = useState(0.8);

  const [showSettings, setShowSettings] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [showSpacingLines, setShowSpacingLines] = useState(true);
  const [showCharts, setShowCharts] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState('normal');
  const [emergencyBrake, setEmergencyBrake] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  const [vehicleCount, setVehicleCount] = useState(6);
  const [weather, setWeather] = useState('clear');
  const [showV2V, setShowV2V] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showMiniMap, setShowMiniMap] = useState(true);

  const [velocityHistory, setVelocityHistory] = useState([]);
  const [spacingHistory, setSpacingHistory] = useState([]);
  const [accelerationHistory, setAccelerationHistory] = useState([]);

  const animationRef = useRef(null);
  const lastTimeRef = useRef(0);
  const eventIndexRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mq.matches);
    const handler = (e) => setIsDarkMode(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return;
      switch (e.key.toLowerCase()) {
        case ' ': e.preventDefault(); running ? handleStop() : handleStart(); break;
        case 'r': handleReset(); break;
        case 'e': setEmergencyBrake(true); break;
        case 'arrowup': e.preventDefault(); setTargetSpeed(s => Math.min(MAX_SPEED, s + 1)); break;
        case 'arrowdown': e.preventDefault(); setTargetSpeed(s => Math.max(MIN_SPEED, s - 1)); break;
        case 'arrowleft': e.preventDefault(); setTimeHeadway(t => Math.max(0.5, t - 0.1)); break;
        case 'arrowright': e.preventDefault(); setTimeHeadway(t => Math.min(3.0, t + 0.1)); break;
        case '1': case '2': case '3': case '4': case '5': case '6':
          const scenarios = Object.keys(SCENARIOS);
          const idx = parseInt(e.key) - 1;
          if (idx < scenarios.length && !running) applyScenario(scenarios[idx]);
          break;
        case 'v': setShowV2V(v => !v); break;
        case 'd': setShowDetails(d => !d); break;
        case 'c': setShowCharts(c => !c); break;
        case 'm': setShowMiniMap(m => !m); break;
        case 'w': setWeather(w => { const ws = ['clear', 'rain', 'fog', 'storm']; return ws[(ws.indexOf(w) + 1) % ws.length]; }); break;
        case '?': setShowKeyboardHelp(h => !h); break;
      }
    };
    const handleKeyUp = (e) => { if (e.key.toLowerCase() === 'e') setEmergencyBrake(false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [running]);

  const applyScenario = (key) => {
    const s = SCENARIOS[key];
    setTargetSpeed(s.targetSpeed);
    setTimeHeadway(s.tau);
    setKp(s.kp);
    setKd(s.kd);
    setSelectedScenario(key);
    eventIndexRef.current = 0;
  };

  const processScenarioEvents = (time) => {
    const s = SCENARIOS[selectedScenario];
    if (!s.eventSequence || eventIndexRef.current >= s.eventSequence.length) return;
    const event = s.eventSequence[eventIndexRef.current];
    if (time >= event.time) {
      if (event.action === 'speed') setTargetSpeed(event.value);
      else if (event.action === 'brake') setEmergencyBrake(event.value);
      eventIndexRef.current++;
    }
  };

  const calculateCACCAcceleration = (vehicle, leaderVehicle) => {
    const we = WEATHER_EFFECTS[weather];
    const actualSpacing = leaderVehicle.position - vehicle.position;
    const weatherMult = 1 + (1 - we.visibility) * 0.5;
    const desiredSpacing = (MIN_SPACING + timeHeadway * vehicle.velocity) * weatherMult;
    const spacingError = actualSpacing - desiredSpacing;
    const velocityError = vehicle.velocity - leaderVehicle.velocity;
    vehicle.actualSpacing = actualSpacing;
    vehicle.desiredSpacing = desiredSpacing;
    vehicle.spacingError = spacingError;
    vehicle.velocityError = velocityError;
    vehicle.spacingStatus = Math.abs(spacingError) < 2 ? 'optimal' : spacingError < 0 ? 'close' : 'far';
    const controlInput = kp * spacingError - kd * velocityError;
    vehicle.controlInput = controlInput;
    return Math.max(-8 * we.brakeEfficiency, Math.min(3 * we.friction, controlInput));
  };

  const updateSimulation = useCallback((timestamp) => {
    if (!running) return;
    const baseTime = lastTimeRef.current ? Math.min((timestamp - lastTimeRef.current) / 1000, 0.1) : DT;
    const deltaTime = baseTime * playbackSpeed;
    lastTimeRef.current = timestamp;

    setAnimationTime(prev => prev + baseTime);
    setSimulationTime(prev => { const nt = prev + deltaTime; processScenarioEvents(nt); return nt; });

    setVehicles(prev => {
      const nv = [...prev];
      const li = vehicleCount - 1;
      const leader = nv[li];
      if (!leader) return prev;

      const we = WEATHER_EFFECTS[weather];
      const lts = emergencyBrake ? 0 : targetSpeed;
      const se = lts - leader.velocity;
      leader.desiredAcceleration = Math.sign(se) * Math.min(Math.abs(se) * 2, 3 * we.friction);
      leader.acceleration += ((leader.desiredAcceleration - leader.acceleration) / VEHICLE_TIME_CONSTANT) * deltaTime;
      leader.velocity = Math.max(0, Math.min(MAX_SPEED, leader.velocity + leader.acceleration * deltaTime));
      leader.position += leader.velocity * deltaTime;
      leader.fuelConsumed += ((FUEL_IDLE_RATE + Math.max(0, leader.acceleration) * FUEL_ACCEL_FACTOR) / 100) * leader.velocity * deltaTime / 1000 * leader.type.fuelEfficiency;

      for (let i = li - 1; i >= 0; i--) {
        const v = nv[i];
        const lv = nv[i + 1];
        v.desiredAcceleration = calculateCACCAcceleration(v, lv);
        v.acceleration += ((v.desiredAcceleration - v.acceleration) / VEHICLE_TIME_CONSTANT) * deltaTime;
        v.velocity = Math.max(0, Math.min(MAX_SPEED, v.velocity + v.acceleration * deltaTime));
        v.position += v.velocity * deltaTime;
        v.fuelConsumed += ((FUEL_IDLE_RATE + Math.max(0, v.acceleration) * FUEL_ACCEL_FACTOR) / 100) * v.velocity * deltaTime / 1000 * v.type.fuelEfficiency;
      }
      return nv;
    });

    if (vehicles.length > 0) {
      const leader = vehicles[vehicleCount - 1];
      if (leader) setCameraOffset(prev => prev + (leader.position - prev) * 0.08);
    }

    if (vehicles.length > 0) {
      setVelocityHistory(prev => [...prev, { time: simulationTime, values: vehicles.map(v => v.velocity) }].slice(-HISTORY_LENGTH));
      setSpacingHistory(prev => [...prev, { time: simulationTime, values: vehicles.slice(0, -1).map((v, i) => vehicles[i + 1].position - v.position) }].slice(-HISTORY_LENGTH));
      setAccelerationHistory(prev => [...prev, { time: simulationTime, values: vehicles.map(v => v.acceleration) }].slice(-HISTORY_LENGTH));
    }

    animationRef.current = requestAnimationFrame(updateSimulation);
  }, [running, kp, kd, timeHeadway, targetSpeed, emergencyBrake, vehicleCount, weather, playbackSpeed, vehicles, simulationTime]);

  const handleStart = () => {
    const nv = initializeVehicles(vehicleCount);
    const is = MIN_SPACING + timeHeadway * 0;
    for (let i = vehicleCount - 1; i >= 0; i--) {
      nv[i].position = i === vehicleCount - 1 ? 0 : nv[i + 1].position - is;
    }
    setVehicles(nv);
    setScenery(generateScenery());
    setCameraOffset(0);
    setSimulationTime(0);
    setAnimationTime(0);
    setVelocityHistory([]);
    setSpacingHistory([]);
    setAccelerationHistory([]);
    lastTimeRef.current = 0;
    eventIndexRef.current = 0;
    setRunning(true);
  };

  const handleStop = () => {
    setRunning(false);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  };

  const handleReset = () => {
    handleStop();
    setVehicles([]);
    setScenery([]);
    setCameraOffset(0);
    setSimulationTime(0);
    setEmergencyBrake(false);
    setVelocityHistory([]);
    setSpacingHistory([]);
    setAccelerationHistory([]);
    eventIndexRef.current = 0;
  };

  useEffect(() => {
    if (running) animationRef.current = requestAnimationFrame(updateSimulation);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [running, updateSimulation]);

  const we = WEATHER_EFFECTS[weather];

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isDarkMode ? 'bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white' : 'bg-gradient-to-br from-blue-50 via-white to-purple-50 text-gray-900'}`}>
      <CollisionWarning vehicles={vehicles} isDarkMode={isDarkMode} />
      {showKeyboardHelp && <KeyboardShortcuts isDarkMode={isDarkMode} onClose={() => setShowKeyboardHelp(false)} />}

      <div className="container mx-auto px-4 py-4 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent animate-pulse">
            🚗 Vehicle Platoon Simulator
          </h1>
          <p className="text-sm text-gray-500">CACC with String Stability Analysis • Press <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">?</kbd> for shortcuts</p>
        </div>

        {/* Controls */}
        <div className={`${isDarkMode ? 'bg-gray-800/80' : 'bg-white/80'} backdrop-blur-sm rounded-2xl shadow-xl p-4 mb-4`}>
          <div className="flex flex-wrap gap-2 justify-center items-center mb-3">
            <button onClick={running ? handleStop : handleStart}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold shadow-lg transition-all transform hover:scale-105 ${running ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-green-500 to-emerald-500'} text-white`}>
              {running ? <><Pause size={18} /> Pause</> : <><Play size={18} /> Start</>}
            </button>
            <button onClick={handleReset} className="flex items-center gap-2 px-5 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-bold shadow-lg transition-all hover:scale-105">
              <RotateCcw size={18} /> Reset
            </button>
            {running && (
              <button onMouseDown={() => setEmergencyBrake(true)} onMouseUp={() => setEmergencyBrake(false)} onTouchStart={() => setEmergencyBrake(true)} onTouchEnd={() => setEmergencyBrake(false)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold shadow-lg transition-all ${emergencyBrake ? 'bg-red-700 scale-105' : 'bg-red-500 hover:bg-red-600 hover:scale-105'} text-white`}>
                <Zap size={18} /> Emergency
              </button>
            )}
            <button onClick={() => setShowSettings(!showSettings)} className={`p-2.5 rounded-xl shadow-lg transition-all ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}>
              <Settings size={18} />
            </button>
            <button onClick={() => setShowTutorial(!showTutorial)} className={`p-2.5 rounded-xl shadow-lg transition-all ${isDarkMode ? 'bg-blue-900 hover:bg-blue-800' : 'bg-blue-100 hover:bg-blue-200'}`}>
              <HelpCircle size={18} />
            </button>
          </div>

          {/* Quick controls */}
          <div className="flex flex-wrap gap-3 justify-center items-center mb-3 text-sm">
            <div className="flex items-center gap-2">
              <Users size={14} />
              <select value={vehicleCount} onChange={(e) => setVehicleCount(parseInt(e.target.value))} disabled={running}
                className={`px-2 py-1 rounded-lg text-sm ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} ${running ? 'opacity-50' : ''}`}>
                {Array.from({ length: MAX_VEHICLE_COUNT - MIN_VEHICLE_COUNT + 1 }, (_, i) => <option key={i} value={i + MIN_VEHICLE_COUNT}>{i + MIN_VEHICLE_COUNT}</option>)}
              </select>
            </div>
            <WeatherSelector weather={weather} setWeather={setWeather} isDarkMode={isDarkMode} />
            <div className="flex items-center gap-2">
              <FastForward size={14} />
              <select value={playbackSpeed} onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                className={`px-2 py-1 rounded-lg text-sm ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                {PLAYBACK_SPEEDS.map(s => <option key={s} value={s}>{s}x</option>)}
              </select>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setShowV2V(!showV2V)} className={`p-2 rounded-lg transition-all ${showV2V ? 'bg-cyan-500 text-white' : isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}><Radio size={14} /></button>
              <button onClick={() => setShowMiniMap(!showMiniMap)} className={`p-2 rounded-lg transition-all ${showMiniMap ? 'bg-blue-500 text-white' : isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}><Map size={14} /></button>
            </div>
          </div>

          {/* Scenarios */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5 mb-3">
            {Object.entries(SCENARIOS).map(([key, s], idx) => (
              <button key={key} onClick={() => applyScenario(key)} disabled={running}
                className={`p-2 rounded-lg text-xs transition-all ${selectedScenario === key ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-lg scale-105' : isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} ${running ? 'opacity-50' : ''}`}>
                <div className="font-bold">{idx + 1}. {s.name}</div>
              </button>
            ))}
          </div>

          {/* Settings */}
          {showSettings && (
            <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-xl p-4 mb-3`}>
              <div className="grid md:grid-cols-4 gap-4 text-sm">
                <div>
                  <label className="block font-semibold mb-1">Speed: {targetSpeed.toFixed(0)} m/s</label>
                  <input type="range" min="5" max="30" step="1" value={targetSpeed} onChange={(e) => setTargetSpeed(parseFloat(e.target.value))} className="w-full accent-blue-500" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">τ: {timeHeadway.toFixed(1)}s</label>
                  <input type="range" min="0.5" max="3.0" step="0.1" value={timeHeadway} onChange={(e) => setTimeHeadway(parseFloat(e.target.value))} className="w-full accent-purple-500" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Kp: {kp.toFixed(2)}</label>
                  <input type="range" min="0.1" max="1.0" step="0.05" value={kp} onChange={(e) => setKp(parseFloat(e.target.value))} className="w-full accent-green-500" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Kd: {kd.toFixed(2)}</label>
                  <input type="range" min="0.1" max="2.0" step="0.05" value={kd} onChange={(e) => setKd(parseFloat(e.target.value))} className="w-full accent-orange-500" />
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          {running && vehicles.length > 0 && (
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-blue-900/50' : 'bg-blue-100'}`}>
                <div className="text-xs opacity-70">Speed</div>
                <div className="text-lg font-bold">{vehicles[vehicleCount - 1]?.velocity.toFixed(1)} m/s</div>
              </div>
              <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-green-900/50' : 'bg-green-100'}`}>
                <div className="text-xs opacity-70">Spacing</div>
                <div className="text-lg font-bold">{vehicles.length > 1 ? ((vehicles[vehicleCount - 1].position - vehicles[0].position) / (vehicleCount - 1)).toFixed(1) : '0'}m</div>
              </div>
              <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-purple-900/50' : 'bg-purple-100'}`}>
                <div className="text-xs opacity-70">Time</div>
                <div className="text-lg font-bold">{simulationTime.toFixed(1)}s</div>
              </div>
              <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-cyan-900/50' : 'bg-cyan-100'}`}>
                <div className="text-xs opacity-70 capitalize">{weather}</div>
                <div className="text-lg font-bold">{(we.friction * 100).toFixed(0)}%</div>
              </div>
            </div>
          )}
        </div>

        {/* Animation */}
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl overflow-hidden shadow-2xl mb-4 relative`}>
          {showMiniMap && running && vehicles.length > 0 && (
            <div className="absolute top-2 left-2 z-10"><MiniMap vehicles={vehicles} isDarkMode={isDarkMode} cameraOffset={cameraOffset} /></div>
          )}

          <svg width="100%" height="380" viewBox="0 0 1200 380" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={isDarkMode ? '#0f172a' : weather === 'storm' ? '#374151' : '#60a5fa'} />
                <stop offset="100%" stopColor={isDarkMode ? '#1e293b' : weather === 'storm' ? '#6b7280' : '#dbeafe'} />
              </linearGradient>
              <linearGradient id="roadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#4b5563" />
                <stop offset="100%" stopColor="#1f2937" />
              </linearGradient>
              <linearGradient id="leaderGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Sky */}
            <rect width="1200" height="240" fill="url(#skyGrad)" />

            {/* Stars & shooting star */}
            {scenery.filter(e => e.type === 'star').map(e => <Star key={e.id} {...e} time={animationTime} isDarkMode={isDarkMode} />)}
            <ShootingStar isDarkMode={isDarkMode} time={animationTime} />

            {/* Sun/Moon */}
            {weather === 'clear' && (
              <g>
                <circle cx="1050" cy="70" r={isDarkMode ? 25 : 35} fill={isDarkMode ? '#fef9c3' : '#fef08a'} opacity="0.9">
                  <animate attributeName="r" values={isDarkMode ? "25;27;25" : "35;38;35"} dur="4s" repeatCount="indefinite" />
                </circle>
                {isDarkMode && <circle cx="1040" cy="65" r="22" fill="#0f172a" />}
              </g>
            )}

            {/* Mountains, clouds, birds, planes */}
            {scenery.filter(e => e.type === 'mountain').map(e => {
              const sx = (e.x - cameraOffset * 0.03) % 4000;
              return sx > -200 && sx < 1400 ? <Mountain key={e.id} x={sx} y={e.y} scale={e.scale} height={e.height} isDarkMode={isDarkMode} /> : null;
            })}
            {weather === 'clear' && scenery.filter(e => e.type === 'cloud').map(e => {
              const sx = (e.x - cameraOffset * e.speed) % 4000;
              return sx > -100 && sx < 1300 ? <CloudShape key={e.id} x={sx} y={e.y} scale={e.scale} isDarkMode={isDarkMode} /> : null;
            })}
            {weather === 'clear' && scenery.filter(e => e.type === 'bird').map(e => {
              const sx = (e.x + animationTime * e.speed * 50) % 1400;
              return <Bird key={e.id} x={sx} y={e.y} scale={e.scale} flapOffset={e.flapOffset} time={animationTime} />;
            })}
            {weather === 'clear' && scenery.filter(e => e.type === 'plane').map(e => {
              const sx = (e.x + animationTime * e.speed * 30) % 1500;
              return <Plane key={e.id} x={sx} y={e.y} scale={e.scale} />;
            })}

            {/* Ground */}
            <rect y="240" width="1200" height="25" fill={isDarkMode ? '#1a4d2e' : '#86efac'} />

            {/* Road */}
            <rect y="265" width="1200" height="115" fill="url(#roadGrad)" />
            {(weather === 'rain' || weather === 'storm') && <rect y="265" width="1200" height="115" fill="#60a5fa" opacity="0.08" />}

            {/* Road markings */}
            {Array.from({ length: 25 }, (_, i) => (
              <rect key={i} x={(i * 70 - (cameraOffset * PIXELS_PER_METER) % 70)} y="318" width="35" height="5" fill="#fbbf24" rx="2" opacity="0.9" />
            ))}
            <rect y="265" width="1200" height="3" fill="#fff" opacity="0.8" />
            <rect y="377" width="1200" height="3" fill="#fff" opacity="0.8" />

            {/* Scenery */}
            {scenery.filter(e => !['cloud', 'mountain', 'star', 'bird', 'plane'].includes(e.type)).map(e => {
              const sf = e.type === 'building' ? 0.5 : 1;
              const sx = (e.x - cameraOffset * sf) * PIXELS_PER_METER + 600;
              if (sx < -100 || sx > 1300) return null;
              if (e.type === 'tree') return <Tree key={e.id} x={sx} y={240 + e.y} scale={e.scale} isDarkMode={isDarkMode} swayOffset={e.swayOffset} time={animationTime} />;
              if (e.type === 'pine') return <PineTree key={e.id} x={sx} y={240 + e.y} scale={e.scale} isDarkMode={isDarkMode} swayOffset={e.swayOffset} time={animationTime} />;
              if (e.type === 'building') return <Building key={e.id} x={sx} y={240 + e.y} scale={e.scale} height={e.height} isDarkMode={isDarkMode} time={animationTime} />;
              if (e.type === 'sign') return <RoadSign key={e.id} x={sx} y={240 + e.y} isDarkMode={isDarkMode} />;
              return null;
            })}

            {/* V2V & Vehicles */}
            <g transform="translate(0, 325)">
              <V2VCommunication vehicles={vehicles} cameraOffset={cameraOffset} showV2V={showV2V} />
              {vehicles.map((v, i) => (
                <VehicleComponent key={v.id} vehicle={v} isDarkMode={isDarkMode} pixelX={(v.position - cameraOffset) * PIXELS_PER_METER + 600}
                  showDetails={showDetails} showSpacingLine={showSpacingLines} nextVehicle={i < vehicleCount - 1 ? vehicles[i + 1] : null} weather={weather} time={animationTime} />
              ))}
            </g>

            {/* Weather overlay */}
            {weather === 'rain' && <RainEffect intensity={0.6} />}
            {weather === 'storm' && <RainEffect intensity={1.2} />}
            {weather === 'fog' && <FogEffect intensity={0.7} />}
          </svg>
        </div>

        {/* Charts */}
        {running && showCharts && vehicles.length > 0 && (
          <div className={`grid md:grid-cols-3 gap-3 ${isDarkMode ? 'text-white' : ''}`}>
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-3 rounded-xl shadow-lg`}>
              <StringStabilityIndicator vehicles={vehicles} isDarkMode={isDarkMode} />
              <div className="mt-3 flex justify-center">
                <RealtimeChart title="Velocity" data={velocityHistory} yLabel="m/s" isDarkMode={isDarkMode} colors={vehicles.map(v => v.color)} maxY={MAX_SPEED} />
              </div>
            </div>
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-3 rounded-xl shadow-lg`}>
              <div className="flex justify-center mb-3">
                <RealtimeChart title="Spacing" data={spacingHistory} yLabel="m" isDarkMode={isDarkMode} colors={vehicles.slice(0, -1).map(v => v.color)} />
              </div>
              <div className="flex justify-center">
                <RealtimeChart title="Acceleration" data={accelerationHistory} yLabel="m/s²" isDarkMode={isDarkMode} colors={vehicles.map(v => v.color)} maxY={10} />
              </div>
            </div>
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-3 rounded-xl shadow-lg`}>
              <FuelEfficiencyPanel vehicles={vehicles} simulationTime={simulationTime} isDarkMode={isDarkMode} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlatoonApp;
