import { deploy } from 'ethereum-mars'
import { baseDeployment } from './baseDeployment'

deploy({ verify: false }, baseDeployment)
