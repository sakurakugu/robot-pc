import { ref, watch, type Ref } from 'vue'

type JoystickPayload = { x: number; y: number }
type RuntimeControlMode = 'move' | 'pose' | 'two_leg'

export function useRobotOperationJoystick(options: {
  isConnected: Ref<boolean>
  robotId: Ref<string>
  sendMessage: (message: {
    type: 'manual_command'
    robotId: string
    timestamp: number
    data: {
      command: 'update_velocity'
      mode: RuntimeControlMode
      vx: number
      vy: number
      wz: number
      source: string
    }
  }) => void
}) {
  const controlMode = ref<'move' | 'pose'>('move')
  const speed = ref(5)
  const twoLegStandActive = ref(false)
  const rightJoystickDisabled = ref(false)
  const joystickAxes = ref<[number, number, number, number]>([0, 0, 0, 0])

  watch(twoLegStandActive, (value) => {
    rightJoystickDisabled.value = value
  })

  watch(controlMode, (value) => {
    joystickAxes.value = [0, 0, 0, 0]
    sendMergedJoystick(value === 'pose' ? 'pose' : 'move')
  })

  function sendMergedJoystick(mode: RuntimeControlMode): void {
    if (!options.isConnected.value) {
      return
    }

    const speedRatio = Math.max(0, Math.min(1, speed.value / 30))
    const [axis0, axis1, axis2] = joystickAxes.value
    const velocity = mode === 'two_leg'
      ? { vx: axis0 * 3.0 * speedRatio, vy: 0, wz: axis1 * 1.0 * speedRatio }
      : mode === 'pose'
        ? { vx: 0, vy: 0, wz: 0 }
        : { vx: axis0 * 3.0 * speedRatio, vy: axis1 * 1.0 * speedRatio, wz: axis2 * 3.0 * speedRatio }

    options.sendMessage({
      type: 'manual_command',
      robotId: options.robotId.value,
      timestamp: Date.now(),
      data: {
        command: 'update_velocity',
        mode,
        vx: velocity.vx,
        vy: velocity.vy,
        wz: velocity.wz,
        source: 'pc-ui',
      },
    })
  }

  function onMoveJoystick(payload: JoystickPayload): void {
    if (controlMode.value === 'pose' && !twoLegStandActive.value) {
      return
    }

    const mode = getEffectiveMode(controlMode.value, twoLegStandActive.value)
    joystickAxes.value[0] = payload.x
    joystickAxes.value[1] = payload.y

    if (mode === 'two_leg') {
      joystickAxes.value[2] = 0
      joystickAxes.value[3] = 0
    }

    sendMergedJoystick(mode)
  }

  function onLookJoystick(payload: JoystickPayload): void {
    if (rightJoystickDisabled.value) {
      return
    }

    const mode = getEffectiveMode(controlMode.value, twoLegStandActive.value)
    if (mode === 'pose') {
      joystickAxes.value[2] = payload.x
      joystickAxes.value[3] = payload.y
    } else {
      joystickAxes.value[2] = payload.y
      joystickAxes.value[3] = 0
    }

    sendMergedJoystick(mode)
  }

  function onMoveJoystickEnd(): void {
    if (controlMode.value === 'pose' && !twoLegStandActive.value) {
      return
    }

    const mode = getEffectiveMode(controlMode.value, twoLegStandActive.value)
    if (mode === 'two_leg') {
      joystickAxes.value = [0, 0, 0, 0]
    } else {
      joystickAxes.value[0] = 0
      joystickAxes.value[1] = 0
    }

    sendMergedJoystick(mode)
  }

  function onLookJoystickEnd(): void {
    if (rightJoystickDisabled.value) {
      return
    }

    const mode = getEffectiveMode(controlMode.value, twoLegStandActive.value)
    joystickAxes.value[2] = 0
    joystickAxes.value[3] = 0
    sendMergedJoystick(mode)
  }

  return {
    controlMode,
    speed,
    twoLegStandActive,
    rightJoystickDisabled,
    onMoveJoystick,
    onLookJoystick,
    onMoveJoystickEnd,
    onLookJoystickEnd,
  }
}

function getEffectiveMode(controlMode: 'move' | 'pose', twoLegStandActive: boolean): RuntimeControlMode {
  if (twoLegStandActive) {
    return 'two_leg'
  }
  return controlMode === 'pose' ? 'pose' : 'move'
}
