import os from 'node:os'
import path from 'node:path'

const studioHome = process.env.ROBOT_STUDIO_HOME
  || path.join(os.homedir(), '.robot-pc')
const repoRoot = path.resolve(__dirname, '../../../../../..')

const 配置 = {
  port: Number(process.env.PORT || 9010),
  数据目录: path.join(studioHome, 'data'),
  地图目录: path.join(studioHome, 'data', 'maps'),
  巡逻目录: process.env.ROBOT_STUDIO_WAYPOINT_DIR
    || path.join(repoRoot, 'repos', 'robot-onboard', 'examples', 'patrol'),
}

export default 配置
