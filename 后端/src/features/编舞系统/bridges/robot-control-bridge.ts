import type {
  ConnectionTestResult,
  ProjectRobotConfig,
} from '../types';

type 机器人控制参数 = Pick<ProjectRobotConfig, 'name' | 'robot_ip' | 'local_ip' | 'local_port'>;

/**
 * 编舞系统的机器人控制桥接
 * 工作站第一阶段先保留本地桩实现，后续再接入真实直连控制链路
 */
export class 编舞机器人控制桥接 {
  async testRobotConnection(
    robot: Pick<ProjectRobotConfig, 'robot_ip'>,
  ): Promise<ConnectionTestResult> {
    return {
      success: true,
      connected: true,
      message: `已记录机器人地址 ${robot.robot_ip}，当前为工作站本地桩实现`,
    };
  }

  async connectRobot(robot: 机器人控制参数): Promise<ConnectionTestResult> {
    return {
      success: true,
      connected: true,
      message: `机器人 ${robot.name} 已标记为可连接，后续将切换到真实工作站直连`,
      mode: 'wifi',
    };
  }

  async restartMotionControl(robot: 机器人控制参数): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: `已接受 ${robot.name} 的重启运控请求，当前为工作站本地桩实现`,
    };
  }
}

export default 编舞机器人控制桥接;
