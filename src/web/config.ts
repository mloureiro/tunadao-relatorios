import { loadConfig } from '@/core/config/schema';
import configJson from '../../config/config.json';

export const config = loadConfig(configJson);
