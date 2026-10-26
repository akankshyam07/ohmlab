import type { PartInfo } from '../types'
import { arduinoUno, esp32Devkit } from './boards'
import { battery9v, breadboard, diode1n4007, electrolyticCapacitor, jumperWire, led, potentiometer, pushButton, resistor } from './components'
import { hcSr04, servoSg90 } from './modules'

export const parts: PartInfo[] = [
  arduinoUno,
  esp32Devkit,
  breadboard,
  resistor,
  led,
  pushButton,
  potentiometer,
  electrolyticCapacitor,
  diode1n4007,
  servoSg90,
  hcSr04,
  jumperWire,
  battery9v,
]

export function getPart(id: string): PartInfo | undefined {
  return parts.find((p) => p.id === id)
}
