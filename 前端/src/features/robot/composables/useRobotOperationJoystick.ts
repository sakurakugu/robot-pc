import { ref, watch, type Ref } from 'vue'
import type { DirectControlCommand, DirectControlMode } from './useDirectRobotControl'

type JoystickPayload = { x: number; y: number }

export function useRobotOperationJoystick(options: {
  isConnected: Ref<boolean>
  sendCommand: (message: DirectControlCommand) => void
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

  function sendMergedJoystick(mode: DirectControlMode): void {
    if (!options.isConnected.value) {
      return
    }

    options.sendCommand({
      command: 'joystick',
      mode,
      speed: speed.value,
      joystick: joystickAxes.value,
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

function getEffectiveMode(controlMode: 'move' | 'pose', twoLegStandActive: boolean): DirectControlMode {
  if (twoLegStandActive) {
    return 'two_leg'
  }
  return controlMode === 'pose' ? 'pose' : 'move'
}
