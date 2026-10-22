import { SCORE } from './score-config.js';
/** SI motion units; gas costs are displayed points (main tank 0..100). */
export const CONFIG = Object.freeze({
  step: 1 / 120, cruise: 38.89, practiceSpeed: 24, acceleration: 6, gravity: 9.81,
  groundHeading: .135, headingResponse: 4.2, groundGrip: 5.5, groundLateralAccel: 13,
  airLateralAccel: 4.8, airLateralSpeed: 4.2, airDrag: .7, airForwardDrag: .012, verticalDrag: .025,
  jetResponse: 24, launchPulseTime: .45, launchAcceleration: 34, launchCost: 18,
  airPulseTime: .24, airPulseAcceleration: 22, airPulseCost: 10, pulseCooldown: .55, pulseRamp: .045,
  sustainedUp: 14.8, sustainedCost: 16, microCost: 3, rechargePerSecond: .25,
  ceilingSoft: 24, ceilingTop: 30,
  angularSpeed: 6.8, angularAcceleration: 24, driveResponse: 7, angularDrag: .3,
  brakeAcceleration: 24, brakeResponse: 9, rotationGas: { roll: .32, pitch: .36, yaw: .32 },
  levelWindow: 2.2, levelDelay: .28, levelEntrySpeed: .7, levelSpeed: 3.2, levelResponse: 3, levelDamping: 8, levelAcceleration: 18,
  turnReverseTolerance: .035, touchDeadzone: 8, touchFullTravel: 38, settleMargin: .28,
  supplyValues: [20, 10, 5], supplyRing: 30, flightSupplyCap: 60,
  bufferBrake: 18, bufferTouchSpeed: 3.8, bufferMargin: 1.4, bufferResponse: 8,
  contactSpring: 460, contactDamping: 30, roadHalfWidth: 13, carHalfWidth: 1.12, carHalfLength: 2.1, carCenterHeight: .76,
  crashRecovery: 1, recoverySpeed: 21, recoveryEnergy: 1,
  precisionAngularRates: {pitch:.6,roll:.6,yaw:.6}, landingHeadingAngles: [25,40,105], landingYawRates: [.6,1.5,3.5], landingAngles: [18, 30, 65], landingSpeeds: [4.6, 7, 14], landingFactors: [1.2, 1, .5, 0],
  wallHeight: 1.15, wallHalfWidth: 7, wallDepth: 1.5, trackPeriod: 1200, wallOffsets: [320, 760, 810],
  popupHold: 1.7, popupEnd: 2,
});
export const STUNTS = Object.freeze({
  left: { label: '左侧滚', category: 'roll', axis: 'roll', sign: 1, points: SCORE.points.roll },
  right: { label: '右侧滚', category: 'roll', axis: 'roll', sign: -1, points: SCORE.points.roll },
  yawLeft: { label: '水平左转', category: 'yaw', axis: 'yaw', sign: -1, points: SCORE.points.yaw },
  yawRight: { label: '水平右转', category: 'yaw', axis: 'yaw', sign: 1, points: SCORE.points.yaw },
  front: { label: '前空翻', category: 'front', axis: 'pitch', sign: 1, points: SCORE.points.front },
  back: { label: '后空翻', category: 'back', axis: 'pitch', sign: -1, points: SCORE.points.back },
});
