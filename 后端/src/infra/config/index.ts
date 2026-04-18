import os from 'node:os'
import path from 'node:path'

const studioHome = process.env.ROBOT_STUDIO_HOME
  || path.join(os.homedir(), '.robot-studio')

const 配置 = {
  port: Number(process.env.PORT || 9010),
  数据目录: path.join(studioHome, 'data'),
  地图目录: path.join(studioHome, 'data', 'maps'),
}

export default 配置
