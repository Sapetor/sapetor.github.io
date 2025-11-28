import { Play, Pause, RotateCcw, Settings, Info, Zap, ChevronDown, ChevronUp, HelpCircle, TrendingUp, Activity } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';

// Constants
const VEHICLE_COUNT = 6;
const LEADER_BASE_POSITION = 650;
const MAX_SPEED = 30; // m/s (108 km/h)
const MIN_SPEED = 0;
const PIXELS_PER_METER = 10;
const HISTORY_LENGTH = 200; // frames of history for charts

// CACC Parameters
const MIN_SPACING = 5; // meters - minimum safety distance
const DEFAULT_TIME_HEADWAY = 1.2; // seconds
const VEHICLE_TIME_CONSTANT = 0.3; // seconds - actuator lag
const DT = 1/60; // 60 fps

// Scenario presets
const SCENARIOS = {
  normal: {
    name: "Normal Cruising",
    description: "Steady highway driving at moderate speed",
    targetSpeed: 20,
    tau: 1.2,
    kp: 0.4,
    kd: 0.8,
    eventSequence: []
  },
  aggressive: {
    name: "Aggressive Following",
    description: "Short time headway - tests string stability",
    targetSpeed: 25,
    tau: 0.6,
    kp: 0.6,
    kd: 0.7,
    eventSequence: []
  },
  stopAndGo: {
    name: "Stop & Go Traffic",
    description: "Simulates traffic congestion with speed changes",
    targetSpeed: 15,
    tau: 1.5,
    kp: 0.5,
    kd: 0.9,
    eventSequence: [
      { time: 2, action: 'speed', value: 5 },
      { time: 5, action: 'speed', value: 15 },
      { time: 8, action: 'speed', value: 0 },
      { time: 11, action: 'speed', value: 20 }
    ]
  },
  emergencyBraking: {
    name: "Emergency Braking",
    description: "Sudden deceleration - tests safety",
    targetSpeed: 25,
    tau: 1.0,
    kp: 0.5,
    kd: 1.0,
    eventSequence: [
      { time: 3, action: 'brake', value: true },
      { time: 6, action: 'brake', value: false },
      { time: 8, action: 'speed', value: 25 }
    ]
  },
  conservative: {
    name: "Conservative Following",
    description: "Large time headway for maximum comfort",
    targetSpeed: 20,
    tau: 2.0,
    kp: 0.3,
    kd: 1.0,
    eventSequence: []
  }
};

// Vehicle types with different characteristics
const VEHICLE_TYPES = [
  { name: 'sedan', length: 4.5, color: 'blue', maxAccel: 3.0 },
  { name: 'suv', length: 5.0, color: 'red', maxAccel: 2.5 },
  { name: 'truck', length: 6.0, color: 'orange', maxAccel: 2.0 },
  { name: 'sports', length: 4.2, color: 'purple', maxAccel: 4.0 },
];

// Initialize vehicles with CACC
const initializeVehicles = () => {
  return Array(VEHICLE_COUNT).fill(0).map((_, i) => ({
    id: i,
    position: 0, // meters
    velocity: 0, // m/s
    acceleration: 0, // m/s²
    desiredAcceleration: 0,
    color: `hsl(${(i * 360 / VEHICLE_COUNT + 200)}, 75%, 55%)`,
    isLeader: i === VEHICLE_COUNT - 1,
    type: VEHICLE_TYPES[i % VEHICLE_TYPES.length],
    controlInput: 0,
    spacingError: 0,
    velocityError: 0
  }));
};

// Road scenery elements - enhanced
const generateScenery = () => {
  const elements = [];
  let id = 0;

  // Clouds
  for (let x = 0; x < 4000; x += 200 + Math.random() * 150) {
    elements.push({
      id: id++,
      x,
      y: 30 + Math.random() * 80,
      type: 'cloud',
      scale: 0.6 + Math.random() * 0.6,
      speed: 0.1 + Math.random() * 0.1
    });
  }

  // Trees with variety
  for (let x = 0; x < 3000; x += 60 + Math.random() * 40) {
    const treeType = Math.random() > 0.5 ? 'tree' : 'pine';
    elements.push({
      id: id++,
      x,
      y: -50 - Math.random() * 20,
      type: treeType,
      scale: 0.6 + Math.random() * 0.4,
      offset: Math.random() * 360
    });
  }

  // Buildings in background
  for (let x = 100; x < 3000; x += 200 + Math.random() * 100) {
    elements.push({
      id: id++,
      x,
      y: -120,
      type: 'building',
      scale: 0.8 + Math.random() * 0.4,
      height: 60 + Math.random() * 40
    });
  }

  // Road signs
  for (let x = 200; x < 3000; x += 400) {
    elements.push({
      id: id++,
      x,
      y: -30,
      type: 'sign',
      scale: 1
    });
  }

  // Mountains in far background
  for (let x = 0; x < 4000; x += 300) {
    elements.push({
      id: id++,
      x,
      y: -200,
      type: 'mountain',
      scale: 1 + Math.random() * 0.5,
      height: 100 + Math.random() * 50
    });
  }

  return elements;
};

// Cloud Component
const Cloud = ({ x, y, scale, isDarkMode }) => (
  <g transform={`translate(${x}, ${y}) scale(${scale})`} opacity="0.7">
    <ellipse cx="0" cy="0" rx="25" ry="12" fill={isDarkMode ? "#e0e7ff" : "#fff"} />
    <ellipse cx="-15" cy="2" rx="18" ry="10" fill={isDarkMode ? "#e0e7ff" : "#fff"} />
    <ellipse cx="15" cy="3" rx="20" ry="11" fill={isDarkMode ? "#e0e7ff" : "#fff"} />
  </g>
);

// Mountain Component
const Mountain = ({ x, y, scale, height, isDarkMode }) => (
  <g transform={`translate(${x}, ${y}) scale(${scale})`}>
    <polygon
      points={`0,0 ${height/2},${-height} ${height},0`}
      fill={isDarkMode ? "#1e293b" : "#64748b"}
      opacity="0.3"
    />
    <polygon
      points={`${height/2},${-height} ${height*0.6},${-height*0.7} ${height*0.7},${-height*0.5}`}
      fill={isDarkMode ? "#f8fafc" : "#fff"}
      opacity="0.8"
    />
  </g>
);

// Tree Component
const Tree = ({ x, y, scale, isDarkMode, offset }) => (
  <g transform={`translate(${x}, ${y}) scale(${scale})`}>
    <ellipse cx="0" cy="-25" rx="18" ry="25" fill={isDarkMode ? "#2d5016" : "#4a7c2e"} opacity="0.9" />
    <ellipse cx="-8" cy="-30" rx="15" ry="20" fill={isDarkMode ? "#3a6320" : "#5a9438"} opacity="0.8" />
    <ellipse cx="8" cy="-28" rx="13" ry="18" fill={isDarkMode ? "#3a6320" : "#5a9438"} opacity="0.8" />
    <rect x="-4" y="-10" width="8" height="20" fill="#3d2817" rx="2" />
  </g>
);

// Pine Tree Component
const PineTree = ({ x, y, scale, isDarkMode }) => (
  <g transform={`translate(${x}, ${y}) scale(${scale})`}>
    <polygon points="0,-40 -12,-20 12,-20" fill={isDarkMode ? "#2d5016" : "#4a7c2e"} />
    <polygon points="0,-30 -14,-10 14,-10" fill={isDarkMode ? "#2d5016" : "#4a7c2e"} />
    <polygon points="0,-20 -16,0 16,0" fill={isDarkMode ? "#3a6320" : "#5a9438"} />
    <rect x="-3" y="0" width="6" height="15" fill="#3d2817" />
  </g>
);

// Building Component
const Building = ({ x, y, scale, height, isDarkMode }) => {
  const windowRows = Math.floor(height / 15);
  const windows = [];

  for (let row = 0; row < windowRows; row++) {
    for (let col = 0; col < 3; col++) {
      windows.push(
        <rect
          key={`${row}-${col}`}
          x={-25 + col * 18}
          y={-height + 10 + row * 15}
          width="10"
          height="10"
          fill={isDarkMode ? "#fbbf24" : "#cbd5e0"}
          opacity={isDarkMode ? 0.6 : 0.8}
        />
      );
    }
  }

  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      <rect x="-30" y={-height} width="60" height={height} fill={isDarkMode ? "#2d3748" : "#4a5568"} opacity="0.6" />
      {windows}
      <polygon points="-30,0 0,-15 30,0" fill={isDarkMode ? "#1a202c" : "#2d3748"} opacity="0.7" />
    </g>
  );
};

// Road Sign Component
const RoadSign = ({ x, y, isDarkMode }) => (
  <g transform={`translate(${x}, ${y})`}>
    <rect x="-2" y="-5" width="4" height="35" fill={isDarkMode ? "#718096" : "#4a5568"} />
    <circle cx="0" cy="-15" r="12" fill="#3b82f6" stroke="#fff" strokeWidth="2" />
    <text x="0" y="-10" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold">V</text>
  </g>
);

// Enhanced Vehicle Component with detailed design
const VehicleComponent = ({ vehicle, isDarkMode, pixelX, showDetails, showSpacingLine, nextVehicle }) => {
  const isAccelerating = vehicle.acceleration > 0.5;
  const isBraking = vehicle.acceleration < -0.5;

  return (
    <g>
      {/* Spacing line to leader */}
      {showSpacingLine && nextVehicle && (
        <g>
          <line
            x1={pixelX}
            y1="-10"
            x2={(nextVehicle.position - vehicle.position) * PIXELS_PER_METER + pixelX}
            y2="-10"
            stroke={vehicle.spacingStatus === 'optimal' ? '#10b981' :
                    vehicle.spacingStatus === 'close' ? '#ef4444' : '#3b82f6'}
            strokeWidth="3"
            strokeDasharray="8,4"
            opacity="0.6"
          />
          {/* Spacing value label */}
          <text
            x={pixelX + (nextVehicle.position - vehicle.position) * PIXELS_PER_METER / 2}
            y="-18"
            textAnchor="middle"
            fill={isDarkMode ? '#fff' : '#1f2937'}
            fontSize="12"
            fontWeight="600"
          >
            {(nextVehicle.position - vehicle.position).toFixed(1)}m
          </text>
        </g>
      )}

      <g transform={`translate(${pixelX}, 0)`}>
        {/* Vehicle shadow */}
        <ellipse cx="0" cy="25" rx="35" ry="8" fill="#000" opacity="0.2" />

        {/* Speed lines when moving fast */}
        {vehicle.velocity > 15 && (
          <g opacity="0.4">
            {[-3, 0, 3].map(offset => (
              <line
                key={offset}
                x1="-50"
                y1={offset}
                x2="-35"
                y2={offset}
                stroke={isDarkMode ? '#60a5fa' : '#3b82f6'}
                strokeWidth="2"
              />
            ))}
          </g>
        )}

        {/* Vehicle body with gradient */}
        <defs>
          <linearGradient id={`vehicle-grad-${vehicle.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{stopColor: vehicle.color, stopOpacity: 1}} />
            <stop offset="50%" style={{stopColor: vehicle.color, stopOpacity: 0.85}} />
            <stop offset="100%" style={{stopColor: vehicle.color, stopOpacity: 0.6}} />
          </linearGradient>
          <radialGradient id={`headlight-${vehicle.id}`}>
            <stop offset="0%" style={{stopColor: '#fff', stopOpacity: 0.8}} />
            <stop offset="100%" style={{stopColor: '#ffeb3b', stopOpacity: 0}} />
          </radialGradient>
        </defs>

        {/* Headlight beams when accelerating */}
        {isAccelerating && vehicle.velocity > 5 && (
          <ellipse cx="50" cy="0" rx="70" ry="25" fill={`url(#headlight-${vehicle.id})`} opacity="0.3" />
        )}

        {/* Main body with shine effect */}
        <rect x="-30" y="-12" width="60" height="24" fill={`url(#vehicle-grad-${vehicle.id})`} rx="8" />
        <rect x="-25" y="-10" width="50" height="3" fill="#fff" opacity="0.3" rx="2" />

        {/* Roof/cabin */}
        <path
          d="M -15,-12 L -10,-22 L 10,-22 L 15,-12 Z"
          fill={vehicle.color}
          opacity="0.9"
        />

        {/* Windows with reflections */}
        <rect x="-12" y="-20" width="10" height="8" fill={isDarkMode ? "#1a1a2e" : "#dbeafe"} rx="2" opacity="0.9" />
        <rect x="-11" y="-19" width="3" height="6" fill="#fff" opacity="0.4" rx="1" />
        <rect x="2" y="-20" width="10" height="8" fill={isDarkMode ? "#1a1a2e" : "#dbeafe"} rx="2" opacity="0.9" />
        <rect x="3" y="-19" width="3" height="6" fill="#fff" opacity="0.4" rx="1" />

        {/* Side mirror */}
        <rect x="-32" y="-2" width="3" height="4" fill={vehicle.color} opacity="0.8" />

        {/* Wheels with rotation effect */}
        <g>
          <circle cx="-18" cy="12" r="7" fill="#1a1a1a" />
          <circle cx="-18" cy="12" r="4" fill="#4a5568" />
          <circle cx="-18" cy="12" r="2" fill="#718096" />

          <circle cx="18" cy="12" r="7" fill="#1a1a1a" />
          <circle cx="18" cy="12" r="4" fill="#4a5568" />
          <circle cx="18" cy="12" r="2" fill="#718096" />
        </g>

        {/* Front grille */}
        <rect x="28" y="-8" width="2" height="16" fill="#1a1a1a" rx="1" />
        <rect x="28" y="-5" width="4" height="2" fill="#333" />
        <rect x="28" y="0" width="4" height="1" fill="#333" />
        <rect x="28" y="3" width="4" height="2" fill="#333" />

        {/* Headlights with glow */}
        <circle cx="30" cy="-6" r="3" fill={isAccelerating ? "#ffeb3b" : "#fff9c4"} opacity={isAccelerating ? 1 : 0.7} />
        <circle cx="30" cy="6" r="3" fill={isAccelerating ? "#ffeb3b" : "#fff9c4"} opacity={isAccelerating ? 1 : 0.7} />

        {/* Brake lights with intensity */}
        <rect x="-31" y="-7" width="3" height="5" fill={isBraking ? "#ef4444" : "#7f1d1d"} rx="1"
              opacity={isBraking ? 1 : 0.4} />
        <rect x="-31" y="2" width="3" height="5" fill={isBraking ? "#ef4444" : "#7f1d1d"} rx="1"
              opacity={isBraking ? 1 : 0.4} />
        {isBraking && (
          <>
            <rect x="-32" y="-8" width="1" height="7" fill="#ff6b6b" opacity="0.6" />
            <rect x="-32" y="1" width="1" height="7" fill="#ff6b6b" opacity="0.6" />
          </>
        )}

        {/* Leader badge */}
        {vehicle.isLeader && (
          <g transform="translate(0, -38)">
            <rect x="-24" y="-14" width="48" height="20" fill="#fbbf24" rx="5" stroke="#f59e0b" strokeWidth="2" />
            <text x="0" y="1" textAnchor="middle" fill="#1f2937" fontSize="11" fontWeight="bold">
              👑 LEADER
            </text>
          </g>
        )}

        {/* Velocity display */}
        {showDetails && (
          <g transform="translate(0, 38)">
            <rect x="-28" y="0" width="56" height="18" fill={isDarkMode ? "#1f2937" : "#fff"} rx="5" opacity="0.95" stroke={isDarkMode ? "#4b5563" : "#d1d5db"} strokeWidth="1" />
            <text x="0" y="12" textAnchor="middle" fill={isDarkMode ? '#fff' : '#1f2937'} fontSize="11" fontWeight="700">
              {vehicle.velocity.toFixed(1)} m/s
            </text>
          </g>
        )}

        {/* Spacing status indicator with pulse animation */}
        {!vehicle.isLeader && showDetails && (
          <g>
            <circle cx="0" cy="-30" r="6"
              fill={vehicle.spacingStatus === 'optimal' ? '#10b981' :
                    vehicle.spacingStatus === 'close' ? '#ef4444' : '#3b82f6'}
              opacity="0.9"
            />
            {vehicle.spacingStatus === 'close' && (
              <circle cx="0" cy="-30" r="8"
                fill="#ef4444"
                opacity="0.3"
              >
                <animate attributeName="r" values="6;10;6" dur="1s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.3;0;0.3" dur="1s" repeatCount="indefinite" />
              </circle>
            )}
          </g>
        )}

        {/* Acceleration indicator */}
        {showDetails && Math.abs(vehicle.acceleration) > 0.2 && (
          <g transform="translate(0, -45)">
            <text x="0" y="0" textAnchor="middle"
                  fill={vehicle.acceleration > 0 ? '#10b981' : '#ef4444'}
                  fontSize="10" fontWeight="600">
              {vehicle.acceleration > 0 ? '↑' : '↓'} {Math.abs(vehicle.acceleration).toFixed(1)} m/s²
            </text>
          </g>
        )}
      </g>
    </g>
  );
};

// Real-time Chart Component
const RealtimeChart = ({ title, data, maxDataPoints, yLabel, isDarkMode, colors, maxY }) => {
  if (data.length < 2) return null;

  const width = 400;
  const height = 150;
  const padding = { top: 25, right: 10, bottom: 25, left: 45 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate max value for y-axis
  const dataMax = maxY || Math.max(...data.map(d => Math.max(...d.values)), 0.1);
  const yMax = dataMax * 1.1;

  return (
    <div className="inline-block">
      <svg width={width} height={height} className={`border rounded-lg ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
        <rect width={width} height={height} fill={isDarkMode ? '#1f2937' : '#f9fafb'} />

        {/* Title */}
        <text x={width/2} y={15} textAnchor="middle" fill={isDarkMode ? '#e5e7eb' : '#374151'} fontSize="12" fontWeight="600">
          {title}
        </text>

        {/* Y-axis label */}
        <text x={15} y={height/2} textAnchor="middle" fill={isDarkMode ? '#9ca3af' : '#6b7280'} fontSize="10"
              transform={`rotate(-90, 15, ${height/2})`}>
          {yLabel}
        </text>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1.0].map((frac, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={padding.top + chartHeight * (1 - frac)}
              x2={padding.left + chartWidth}
              y2={padding.top + chartHeight * (1 - frac)}
              stroke={isDarkMode ? '#374151' : '#e5e7eb'}
              strokeWidth="1"
              strokeDasharray="2,2"
            />
            <text
              x={padding.left - 5}
              y={padding.top + chartHeight * (1 - frac) + 3}
              textAnchor="end"
              fill={isDarkMode ? '#9ca3af' : '#6b7280'}
              fontSize="9"
            >
              {(yMax * frac).toFixed(1)}
            </text>
          </g>
        ))}

        {/* Axes */}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartHeight}
              stroke={isDarkMode ? '#4b5563' : '#9ca3af'} strokeWidth="2" />
        <line x1={padding.left} y1={padding.top + chartHeight} x2={padding.left + chartWidth} y2={padding.top + chartHeight}
              stroke={isDarkMode ? '#4b5563' : '#9ca3af'} strokeWidth="2" />

        {/* Data lines */}
        {data.length > 0 && data[0].values.map((_, vehicleIdx) => {
          const points = data.map((snapshot, timeIdx) => {
            const x = padding.left + (timeIdx / Math.max(data.length - 1, 1)) * chartWidth;
            const y = padding.top + chartHeight - (snapshot.values[vehicleIdx] / yMax) * chartHeight;
            return `${x},${y}`;
          }).join(' ');

          return (
            <polyline
              key={vehicleIdx}
              points={points}
              fill="none"
              stroke={colors[vehicleIdx] || `hsl(${(vehicleIdx * 360 / VEHICLE_COUNT)}, 70%, 50%)`}
              strokeWidth="2"
              opacity="0.8"
            />
          );
        })}

        {/* X-axis label */}
        <text x={padding.left + chartWidth/2} y={height - 5} textAnchor="middle"
              fill={isDarkMode ? '#9ca3af' : '#6b7280'} fontSize="10">
          Time
        </text>
      </svg>
    </div>
  );
};

// String Stability Indicator
const StringStabilityIndicator = ({ vehicles, isDarkMode }) => {
  if (vehicles.length < 3) return null;

  // Calculate amplification ratio (compare first and last follower velocity variance)
  const leader = vehicles[vehicles.length - 1];
  const velocities = vehicles.slice(0, -1).map(v => v.velocity);

  const avgVel = velocities.reduce((a, b) => a + b, 0) / velocities.length;
  const variance = velocities.reduce((sum, v) => sum + Math.pow(v - avgVel, 2), 0) / velocities.length;

  // String stability score (0-100, higher is better)
  const stabilityScore = Math.max(0, 100 - variance * 20);
  const isStable = stabilityScore > 70;

  return (
    <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
      <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
        <TrendingUp size={16} />
        String Stability Analysis
      </h3>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex justify-between text-xs mb-1">
            <span>Score</span>
            <span className="font-bold">{stabilityScore.toFixed(0)}%</span>
          </div>
          <div className={`h-3 rounded-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} overflow-hidden`}>
            <div
              className={`h-full transition-all duration-500 ${
                isStable ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-orange-500 to-red-500'
              }`}
              style={{ width: `${stabilityScore}%` }}
            />
          </div>
        </div>
        <div className={`px-3 py-2 rounded-lg font-bold text-xs ${
          isStable
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
            : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100'
        }`}>
          {isStable ? '✓ STABLE' : '⚠ UNSTABLE'}
        </div>
      </div>
      <div className="mt-2 text-xs opacity-75">
        Velocity variance: {variance.toFixed(3)} m²/s²
      </div>
    </div>
  );
};

// Main Platoon App
const PlatoonApp = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [running, setRunning] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [scenery, setScenery] = useState([]);
  const [cameraOffset, setCameraOffset] = useState(0);
  const [simulationTime, setSimulationTime] = useState(0);

  // CACC parameters
  const [timeHeadway, setTimeHeadway] = useState(DEFAULT_TIME_HEADWAY);
  const [targetSpeed, setTargetSpeed] = useState(20); // m/s
  const [kp, setKp] = useState(0.4);
  const [kd, setKd] = useState(0.8);

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [showSpacingLines, setShowSpacingLines] = useState(true);
  const [showCharts, setShowCharts] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState('normal');
  const [emergencyBrake, setEmergencyBrake] = useState(false);

  // Data history for charts
  const [velocityHistory, setVelocityHistory] = useState([]);
  const [spacingHistory, setSpacingHistory] = useState([]);
  const [accelerationHistory, setAccelerationHistory] = useState([]);

  const animationRef = useRef(null);
  const lastTimeRef = useRef(0);
  const eventIndexRef = useRef(0);

  // Detect dark mode
  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeMediaQuery.matches);
    const handler = (e) => setIsDarkMode(e.matches);
    darkModeMediaQuery.addEventListener('change', handler);
    return () => darkModeMediaQuery.removeEventListener('change', handler);
  }, []);

  // Apply scenario
  const applyScenario = (scenarioKey) => {
    const scenario = SCENARIOS[scenarioKey];
    setTargetSpeed(scenario.targetSpeed);
    setTimeHeadway(scenario.tau);
    setKp(scenario.kp);
    setKd(scenario.kd);
    setSelectedScenario(scenarioKey);
    eventIndexRef.current = 0;
  };

  // Process scenario events
  const processScenarioEvents = (time) => {
    const scenario = SCENARIOS[selectedScenario];
    if (!scenario.eventSequence || eventIndexRef.current >= scenario.eventSequence.length) return;

    const event = scenario.eventSequence[eventIndexRef.current];
    if (time >= event.time) {
      if (event.action === 'speed') {
        setTargetSpeed(event.value);
      } else if (event.action === 'brake') {
        setEmergencyBrake(event.value);
      }
      eventIndexRef.current++;
    }
  };

  // CACC Control Law
  const calculateCACCAcceleration = (vehicle, leaderVehicle) => {
    const actualSpacing = leaderVehicle.position - vehicle.position;
    const desiredSpacing = MIN_SPACING + timeHeadway * vehicle.velocity;
    const spacingError = actualSpacing - desiredSpacing;
    const velocityError = vehicle.velocity - leaderVehicle.velocity;

    // Store for visualization and analysis
    vehicle.actualSpacing = actualSpacing;
    vehicle.desiredSpacing = desiredSpacing;
    vehicle.spacingError = spacingError;
    vehicle.velocityError = velocityError;
    vehicle.spacingStatus = Math.abs(spacingError) < 2 ? 'optimal' :
                            spacingError < 0 ? 'close' : 'far';

    // CACC control law: u = kp * spacing_error - kd * velocity_error
    const controlInput = kp * spacingError - kd * velocityError;
    vehicle.controlInput = controlInput;

    // Clamp to realistic acceleration limits
    return Math.max(-8, Math.min(3, controlInput));
  };

  // Animation loop
  const updateSimulation = (timestamp) => {
    if (!running) return;

    const deltaTime = lastTimeRef.current ? Math.min((timestamp - lastTimeRef.current) / 1000, 0.1) : DT;
    lastTimeRef.current = timestamp;

    setSimulationTime(prev => {
      const newTime = prev + deltaTime;
      processScenarioEvents(newTime);
      return newTime;
    });

    setVehicles(prev => {
      const newVehicles = [...prev];
      const leaderIndex = VEHICLE_COUNT - 1;
      const leader = newVehicles[leaderIndex];

      // Leader follows target speed with smooth acceleration
      const leaderTargetSpeed = emergencyBrake ? 0 : targetSpeed;
      const speedError = leaderTargetSpeed - leader.velocity;
      leader.desiredAcceleration = Math.sign(speedError) * Math.min(Math.abs(speedError) * 2, 3);

      // First-order actuator dynamics for leader
      const accelError = leader.desiredAcceleration - leader.acceleration;
      leader.acceleration += (accelError / VEHICLE_TIME_CONSTANT) * deltaTime;

      // Update leader velocity and position
      leader.velocity = Math.max(0, Math.min(MAX_SPEED, leader.velocity + leader.acceleration * deltaTime));
      leader.position += leader.velocity * deltaTime;

      // Update followers with CACC
      for (let i = leaderIndex - 1; i >= 0; i--) {
        const vehicle = newVehicles[i];
        const leaderVehicle = newVehicles[i + 1];

        // Calculate CACC control input
        vehicle.desiredAcceleration = calculateCACCAcceleration(vehicle, leaderVehicle);

        // First-order actuator dynamics
        const accelError = vehicle.desiredAcceleration - vehicle.acceleration;
        vehicle.acceleration += (accelError / VEHICLE_TIME_CONSTANT) * deltaTime;

        // Update velocity and position
        vehicle.velocity = Math.max(0, Math.min(MAX_SPEED, vehicle.velocity + vehicle.acceleration * deltaTime));
        vehicle.position += vehicle.velocity * deltaTime;
      }

      return newVehicles;
    });

    // Update camera to follow leader smoothly
    if (vehicles.length > 0) {
      const leader = vehicles[VEHICLE_COUNT - 1];
      setCameraOffset(prev => prev + (leader.position - prev) * 0.1);
    }

    // Update data history
    if (vehicles.length > 0) {
      setVelocityHistory(prev => {
        const newData = [...prev, { time: simulationTime, values: vehicles.map(v => v.velocity) }];
        return newData.slice(-HISTORY_LENGTH);
      });

      setSpacingHistory(prev => {
        const spacings = vehicles.slice(0, -1).map((v, i) => vehicles[i + 1].position - v.position);
        const newData = [...prev, { time: simulationTime, values: spacings }];
        return newData.slice(-HISTORY_LENGTH);
      });

      setAccelerationHistory(prev => {
        const newData = [...prev, { time: simulationTime, values: vehicles.map(v => v.acceleration) }];
        return newData.slice(-HISTORY_LENGTH);
      });
    }

    animationRef.current = requestAnimationFrame(updateSimulation);
  };

  // Start simulation
  const handleStart = () => {
    const newVehicles = initializeVehicles();
    const initialSpacing = MIN_SPACING + timeHeadway * 0;

    // Position vehicles
    for (let i = VEHICLE_COUNT - 1; i >= 0; i--) {
      if (i === VEHICLE_COUNT - 1) {
        newVehicles[i].position = 0;
      } else {
        newVehicles[i].position = newVehicles[i + 1].position - initialSpacing;
      }
    }

    setVehicles(newVehicles);
    setScenery(generateScenery());
    setCameraOffset(0);
    setSimulationTime(0);
    setVelocityHistory([]);
    setSpacingHistory([]);
    setAccelerationHistory([]);
    lastTimeRef.current = 0;
    eventIndexRef.current = 0;
    setRunning(true);
  };

  // Stop simulation
  const handleStop = () => {
    setRunning(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  // Reset simulation
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

  // Animation effect
  useEffect(() => {
    if (running) {
      animationRef.current = requestAnimationFrame(updateSimulation);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [running, kp, kd, timeHeadway, targetSpeed, emergencyBrake]);

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gradient-to-br from-blue-50 via-white to-purple-50 text-gray-900'}`}>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            🚗 Vehicle Platoon Simulator
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300">
            Cooperative Adaptive Cruise Control with String Stability Analysis
          </p>
        </div>

        {/* Control Panel */}
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-2xl p-4 md:p-6 mb-4`}>
          {/* Main Controls */}
          <div className="flex flex-wrap gap-3 justify-center items-center mb-4">
            <button
              onClick={running ? handleStop : handleStart}
              className={`flex items-center gap-2 px-6 md:px-8 py-3 md:py-4 rounded-xl font-bold text-base md:text-lg shadow-lg transition-all transform hover:scale-105 ${
                running
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600'
                  : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
              } text-white`}
            >
              {running ? <><Pause size={20} /> Pause</> : <><Play size={20} /> Start</>}
            </button>

            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-6 md:px-8 py-3 md:py-4 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-bold text-base md:text-lg shadow-lg transition-all transform hover:scale-105"
            >
              <RotateCcw size={20} /> Reset
            </button>

            {running && (
              <button
                onMouseDown={() => setEmergencyBrake(true)}
                onMouseUp={() => setEmergencyBrake(false)}
                onTouchStart={() => setEmergencyBrake(true)}
                onTouchEnd={() => setEmergencyBrake(false)}
                className={`flex items-center gap-2 px-6 md:px-8 py-3 md:py-4 rounded-xl font-bold text-base md:text-lg shadow-lg transition-all transform ${
                  emergencyBrake
                    ? 'bg-red-700 scale-105'
                    : 'bg-red-500 hover:bg-red-600 hover:scale-105'
                } text-white`}
              >
                <Zap size={20} /> Emergency
              </button>
            )}

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-2 px-4 md:px-6 py-3 md:py-4 rounded-xl font-semibold shadow-lg transition-all ${
                isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              <Settings size={18} /> {showSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            <button
              onClick={() => setShowTutorial(!showTutorial)}
              className={`flex items-center gap-2 px-4 md:px-6 py-3 md:py-4 rounded-xl font-semibold shadow-lg transition-all ${
                isDarkMode ? 'bg-blue-900 hover:bg-blue-800' : 'bg-blue-100 hover:bg-blue-200'
              }`}
            >
              <HelpCircle size={18} /> Help
            </button>
          </div>

          {/* Tutorial Overlay */}
          {showTutorial && (
            <div className={`mb-4 p-4 md:p-6 rounded-xl ${isDarkMode ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'} border-2`}>
              <h3 className="text-lg md:text-xl font-bold mb-3 flex items-center gap-2">
                <Info size={20} /> Quick Tutorial
              </h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-semibold mb-2">🎮 Controls:</h4>
                  <ul className="space-y-1 list-disc ml-5">
                    <li><strong>Start/Pause:</strong> Control simulation</li>
                    <li><strong>Reset:</strong> Return to initial state</li>
                    <li><strong>Emergency:</strong> Immediate braking (hold)</li>
                    <li><strong>Scenarios:</strong> Try different traffic conditions</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">📊 Understanding CACC:</h4>
                  <ul className="space-y-1 list-disc ml-5">
                    <li><strong>Time Headway (τ):</strong> Spacing = d₀ + τ·v</li>
                    <li><strong>Green dots:</strong> Optimal spacing</li>
                    <li><strong>Red dots:</strong> Too close (danger!)</li>
                    <li><strong>Blue dots:</strong> Too far (inefficient)</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Scenario Selection */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Activity size={16} /> Scenario Presets
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {Object.entries(SCENARIOS).map(([key, scenario]) => (
                <button
                  key={key}
                  onClick={() => applyScenario(key)}
                  disabled={running}
                  className={`p-3 rounded-lg text-left transition-all text-sm ${
                    selectedScenario === key
                      ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-lg'
                      : isDarkMode
                      ? 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-gray-100 hover:bg-gray-200'
                  } ${running ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="font-bold text-xs md:text-sm">{scenario.name}</div>
                  <div className={`text-xs mt-1 ${selectedScenario === key ? 'text-blue-100' : 'opacity-75'}`}>
                    {scenario.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-xl p-4 md:p-6 mb-4`}>
              <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
                <Settings size={20} /> CACC Parameters
              </h3>

              <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Target Speed: {targetSpeed.toFixed(1)} m/s ({(targetSpeed * 3.6).toFixed(0)} km/h)
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="0.5"
                    value={targetSpeed}
                    onChange={(e) => setTargetSpeed(parseFloat(e.target.value))}
                    className="w-full h-3 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Time Headway (τ): {timeHeadway.toFixed(2)} seconds
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    value={timeHeadway}
                    onChange={(e) => setTimeHeadway(parseFloat(e.target.value))}
                    className="w-full h-3 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Position Gain (Kp): {kp.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={kp}
                    onChange={(e) => setKp(parseFloat(e.target.value))}
                    className="w-full h-3 bg-green-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Velocity Gain (Kd): {kd.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.05"
                    value={kd}
                    onChange={(e) => setKd(parseFloat(e.target.value))}
                    className="w-full h-3 bg-orange-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                  />
                </div>
              </div>

              <div className={`mt-4 p-4 ${isDarkMode ? 'bg-gray-600' : 'bg-blue-50'} rounded-lg text-sm`}>
                <p><strong>CACC Formula:</strong> d<sub>desired</sub> = d<sub>min</sub> + τ · v<sub>ego</sub></p>
                <p className="mt-1"><strong>Control Law:</strong> a = K<sub>p</sub>·(d<sub>actual</sub> - d<sub>desired</sub>) - K<sub>d</sub>·(v<sub>ego</sub> - v<sub>leader</sub>)</p>
              </div>

              {/* Display Options */}
              <div className="mt-4 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showDetails}
                    onChange={(e) => setShowDetails(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Show vehicle details</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSpacingLines}
                    onChange={(e) => setShowSpacingLines(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Show spacing lines</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCharts}
                    onChange={(e) => setShowCharts(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Show charts</span>
                </label>
              </div>
            </div>
          )}

          {/* Info Display */}
          {running && vehicles.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
              <div className={`${isDarkMode ? 'bg-gradient-to-br from-blue-900 to-blue-800' : 'bg-gradient-to-br from-blue-100 to-blue-50'} p-3 rounded-xl`}>
                <div className="text-xs font-semibold opacity-75 mb-1">Leader Speed</div>
                <div className="text-xl md:text-2xl font-bold">
                  {vehicles[VEHICLE_COUNT - 1].velocity.toFixed(1)} m/s
                </div>
                <div className="text-xs opacity-75">
                  {(vehicles[VEHICLE_COUNT - 1].velocity * 3.6).toFixed(0)} km/h
                </div>
              </div>

              <div className={`${isDarkMode ? 'bg-gradient-to-br from-green-900 to-green-800' : 'bg-gradient-to-br from-green-100 to-green-50'} p-3 rounded-xl`}>
                <div className="text-xs font-semibold opacity-75 mb-1">Avg Spacing</div>
                <div className="text-xl md:text-2xl font-bold">
                  {vehicles.length > 1
                    ? ((vehicles[VEHICLE_COUNT-1].position - vehicles[0].position) / (VEHICLE_COUNT-1)).toFixed(1)
                    : '0.0'} m
                </div>
              </div>

              <div className={`${isDarkMode ? 'bg-gradient-to-br from-purple-900 to-purple-800' : 'bg-gradient-to-br from-purple-100 to-purple-50'} p-3 rounded-xl`}>
                <div className="text-xs font-semibold opacity-75 mb-1">Time Headway</div>
                <div className="text-xl md:text-2xl font-bold">{timeHeadway.toFixed(1)}s</div>
              </div>

              <div className={`${isDarkMode ? 'bg-gradient-to-br from-orange-900 to-orange-800' : 'bg-gradient-to-br from-orange-100 to-orange-50'} p-3 rounded-xl`}>
                <div className="text-xs font-semibold opacity-75 mb-1">Sim Time</div>
                <div className="text-xl md:text-2xl font-bold">{simulationTime.toFixed(1)}s</div>
              </div>
            </div>
          )}
        </div>

        {/* Animation Canvas */}
        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-2 rounded-2xl overflow-hidden shadow-2xl mb-4`}>
          <svg width="100%" height="400" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid meet">
            {/* Sky gradient */}
            <defs>
              <linearGradient id="sky-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{stopColor: isDarkMode ? '#1e3a8a' : '#60a5fa', stopOpacity: 1}} />
                <stop offset="50%" style={{stopColor: isDarkMode ? '#1e40af' : '#93c5fd', stopOpacity: 1}} />
                <stop offset="100%" style={{stopColor: isDarkMode ? '#312e81' : '#dbeafe', stopOpacity: 1}} />
              </linearGradient>
              <linearGradient id="road-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{stopColor: '#4b5563', stopOpacity: 1}} />
                <stop offset="100%" style={{stopColor: '#1f2937', stopOpacity: 1}} />
              </linearGradient>
            </defs>

            {/* Sky */}
            <rect width="1200" height="250" fill="url(#sky-gradient)" />

            {/* Sun/Moon */}
            <circle cx="1000" cy="80" r="40" fill={isDarkMode ? '#fbbf24' : '#fef08a'} opacity={isDarkMode ? 0.6 : 0.9} />
            {!isDarkMode && <circle cx="990" cy="75" r="35" fill="#fef9c3" opacity="0.5" />}

            {/* Scenery elements - mountains, clouds */}
            {scenery.filter(e => e.type === 'mountain').map(element => {
              const screenX = (element.x - cameraOffset * 0.05) % 4000;
              if (screenX < -200 || screenX > 1400) return null;
              return <Mountain key={element.id} x={screenX} y={element.y} scale={element.scale} height={element.height} isDarkMode={isDarkMode} />;
            })}

            {scenery.filter(e => e.type === 'cloud').map(element => {
              const screenX = (element.x - cameraOffset * element.speed) % 4000;
              if (screenX < -100 || screenX > 1300) return null;
              return <Cloud key={element.id} x={screenX} y={element.y} scale={element.scale} isDarkMode={isDarkMode} />;
            })}

            {/* Ground */}
            <rect y="250" width="1200" height="30" fill={isDarkMode ? '#1a4d2e' : '#86efac'} />
            <rect y="250" width="1200" height="3" fill={isDarkMode ? '#166534' : '#22c55e'} opacity="0.5" />

            {/* Road */}
            <rect y="280" width="1200" height="120" fill="url(#road-gradient)" />

            {/* Road markings */}
            {Array.from({length: 20}, (_, i) => (
              <rect
                key={i}
                x={(i * 80 - (cameraOffset * PIXELS_PER_METER) % 80)}
                y="335"
                width="40"
                height="6"
                fill="#fbbf24"
                rx="3"
              />
            ))}

            {/* Road edges */}
            <rect y="280" width="1200" height="4" fill="#fff" opacity="0.9" />
            <rect y="396" width="1200" height="4" fill="#fff" opacity="0.9" />

            {/* Scenery elements - trees, buildings, signs */}
            {scenery.filter(e => e.type !== 'cloud' && e.type !== 'mountain').map(element => {
              const speedFactor = element.type === 'building' ? 0.6 : 1;
              const screenX = (element.x - cameraOffset * speedFactor) * PIXELS_PER_METER + 600;
              if (screenX < -100 || screenX > 1300) return null;

              if (element.type === 'tree') {
                return <Tree key={element.id} x={screenX} y={250 + element.y} scale={element.scale} isDarkMode={isDarkMode} offset={element.offset} />;
              } else if (element.type === 'pine') {
                return <PineTree key={element.id} x={screenX} y={250 + element.y} scale={element.scale} isDarkMode={isDarkMode} />;
              } else if (element.type === 'building') {
                return <Building key={element.id} x={screenX} y={250 + element.y} scale={element.scale} height={element.height} isDarkMode={isDarkMode} />;
              } else if (element.type === 'sign') {
                return <RoadSign key={element.id} x={screenX} y={250 + element.y} isDarkMode={isDarkMode} />;
              }
              return null;
            })}

            {/* Vehicles */}
            <g transform="translate(0, 340)">
              {vehicles.map((vehicle, index) => {
                const screenX = (vehicle.position - cameraOffset) * PIXELS_PER_METER + 600;
                const nextVehicle = index < VEHICLE_COUNT - 1 ? vehicles[index + 1] : null;

                return (
                  <VehicleComponent
                    key={vehicle.id}
                    vehicle={vehicle}
                    isDarkMode={isDarkMode}
                    pixelX={screenX}
                    showDetails={showDetails}
                    showSpacingLine={showSpacingLines}
                    nextVehicle={nextVehicle}
                  />
                );
              })}
            </g>
          </svg>
        </div>

        {/* String Stability and Charts */}
        {running && showCharts && vehicles.length > 0 && (
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-4 rounded-xl shadow-lg`}>
              <StringStabilityIndicator vehicles={vehicles} isDarkMode={isDarkMode} />

              <div className="mt-4 flex justify-center">
                <RealtimeChart
                  title="Velocity Profile"
                  data={velocityHistory}
                  maxDataPoints={HISTORY_LENGTH}
                  yLabel="v (m/s)"
                  isDarkMode={isDarkMode}
                  colors={vehicles.map(v => v.color)}
                  maxY={MAX_SPEED}
                />
              </div>
            </div>

            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-4 rounded-xl shadow-lg`}>
              <h3 className="text-sm font-bold mb-3">Real-time Analysis</h3>
              <div className="flex justify-center mb-4">
                <RealtimeChart
                  title="Inter-vehicle Spacing"
                  data={spacingHistory}
                  maxDataPoints={HISTORY_LENGTH}
                  yLabel="spacing (m)"
                  isDarkMode={isDarkMode}
                  colors={vehicles.slice(0, -1).map(v => v.color)}
                />
              </div>
              <div className="flex justify-center">
                <RealtimeChart
                  title="Acceleration"
                  data={accelerationHistory}
                  maxDataPoints={HISTORY_LENGTH}
                  yLabel="a (m/s²)"
                  isDarkMode={isDarkMode}
                  colors={vehicles.map(v => v.color)}
                  maxY={10}
                />
              </div>
            </div>
          </div>
        )}

        {/* Legend and Info */}
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-4 md:p-6`}>
          <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
            <Info size={20} /> About CACC & String Stability
          </h3>

          <div className="grid md:grid-cols-2 gap-4 md:gap-6 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Cooperative Adaptive Cruise Control</h4>
              <p className="mb-2">
                CACC enables vehicles to maintain safe following distances while maximizing traffic flow.
                Each vehicle adjusts its speed based on the leader's velocity and the spacing error.
              </p>
              <p>
                The constant time headway policy ensures spacing increases with speed, maintaining safety
                at higher velocities: <code className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} px-2 py-1 rounded`}>d = d₀ + τ·v</code>
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">String Stability</h4>
              <p className="mb-2">
                String stability ensures that disturbances (like braking) don't amplify as they propagate
                through the platoon. A string-stable platoon maintains smooth, predictable behavior.
              </p>
              <p className="text-xs opacity-75">
                Key factors: Time headway (τ), control gains (Kp, Kd), and vehicle dynamics.
                Larger τ generally improves stability but reduces traffic density.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Visual Indicators</h4>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-green-500"></span>
                  <span>Optimal spacing maintained</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-blue-500"></span>
                  <span>Too far from leader</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-red-500"></span>
                  <span>Too close - safety risk</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Try These Experiments</h4>
              <ul className="space-y-1 text-xs">
                <li>• Compare "Conservative" vs "Aggressive" scenarios</li>
                <li>• Observe velocity oscillations in charts</li>
                <li>• Test emergency braking response</li>
                <li>• Adjust Kp and Kd to see stability effects</li>
                <li>• Watch spacing lines during acceleration/braking</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlatoonApp;
