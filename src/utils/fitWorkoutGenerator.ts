import { PlannedWorkout, WorkoutStep } from '../types/workout';

// Garmin CRC-16 computation table
const CRC_TABLE = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401,
  0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400,
];

function computeCrc16(data: Uint8Array, start: number, length: number): number {
  let crc = 0;
  for (let i = start; i < start + length; i++) {
    const byte = data[i];
    // compute checksum of lower four bits of byte
    let tmp = CRC_TABLE[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[byte & 0xf];

    // now compute checksum of upper four bits of byte
    tmp = CRC_TABLE[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[(byte >> 4) & 0xf];
  }
  return crc;
}

/**
 * Builds a valid Garmin binary .FIT Workout file according to the Flexible and
 * Interoperable Data Transfer (FIT) Protocol Specification for Workout files.
 * This file can be dropped into the GARMIN/NEWFILES/ directory on any Garmin watch.
 */
export function generateGarminFitWorkout(workout: PlannedWorkout): Uint8Array {
  // Estimate buffer size (~1KB is plenty for a workout definition)
  const buffer = new ArrayBuffer(2048);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  let offset = 0;

  // 1. FIT Header (14 bytes)
  const headerSize = 14;
  view.setUint8(offset++, headerSize); // Header size
  view.setUint8(offset++, 0x20);       // Protocol version 2.0
  view.setUint16(offset, 2160, true);  // Profile version 21.60
  offset += 2;
  const dataSizeOffset = offset;
  offset += 4;                         // Data size (fill later)
  view.setUint8(offset++, 0x2e);       // '.'
  view.setUint8(offset++, 0x46);       // 'F'
  view.setUint8(offset++, 0x49);       // 'I'
  view.setUint8(offset++, 0x54);       // 'T'
  view.setUint16(offset, 0x0000, true);// Header CRC (optional, 0 is valid)
  offset += 2;

  const dataStart = offset;

  // 2. File ID Definition Message (Global Msg 0)
  // Local Msg 0: Definition
  view.setUint8(offset++, 0x40); // Definition message, local msg 0
  view.setUint8(offset++, 0);    // Reserved
  view.setUint8(offset++, 0);    // Little endian architecture
  view.setUint16(offset, 0, true); // Global Msg Number: file_id (0)
  offset += 2;
  view.setUint8(offset++, 4);    // 4 fields

  // Field 0: type (enum, 1 byte)
  view.setUint8(offset++, 0); view.setUint8(offset++, 1); view.setUint8(offset++, 0);
  // Field 1: manufacturer (uint16, 2 bytes)
  view.setUint8(offset++, 1); view.setUint8(offset++, 2); view.setUint8(offset++, 132);
  // Field 2: time_created (uint32, 4 bytes)
  view.setUint8(offset++, 4); view.setUint8(offset++, 4); view.setUint8(offset++, 134);
  // Field 3: serial_number (uint32, 4 bytes)
  view.setUint8(offset++, 3); view.setUint8(offset++, 4); view.setUint8(offset++, 140);

  // File ID Data Message
  view.setUint8(offset++, 0x00); // Data message, local msg 0
  view.setUint8(offset++, 5);    // type = 5 (workout file)
  view.setUint16(offset, 1, true); // manufacturer = 1 (Garmin)
  offset += 2;
  // Garmin base epoch 1989-12-31T00:00:00Z (631065600 offset)
  const garminTime = Math.max(0, Math.floor(Date.now() / 1000) - 631065600);
  view.setUint32(offset, garminTime, true);
  offset += 4;
  view.setUint32(offset, 3958472910, true); // Virtual watch serial number
  offset += 4;

  // 3. Workout Definition Message (Global Msg 26)
  // Local Msg 1: Definition
  view.setUint8(offset++, 0x41); // Definition message, local msg 1
  view.setUint8(offset++, 0);
  view.setUint8(offset++, 0);
  view.setUint16(offset, 26, true); // Global Msg Number: workout (26)
  offset += 2;
  view.setUint8(offset++, 4);    // 4 fields

  // Field 0: sport (enum, 1 byte)
  view.setUint8(offset++, 4); view.setUint8(offset++, 1); view.setUint8(offset++, 0);
  // Field 1: sub_sport (enum, 1 byte)
  view.setUint8(offset++, 6); view.setUint8(offset++, 1); view.setUint8(offset++, 0);
  // Field 2: num_valid_steps (uint16, 2 bytes)
  view.setUint8(offset++, 8); view.setUint8(offset++, 2); view.setUint8(offset++, 132);
  // Field 3: wkt_name (string, 16 bytes)
  view.setUint8(offset++, 8); view.setUint8(offset++, 16); view.setUint8(offset++, 7);

  // Workout Data Message
  view.setUint8(offset++, 0x01); // Data message, local msg 1
  view.setUint8(offset++, 1);    // sport = 1 (Running)
  view.setUint8(offset++, 0);    // sub_sport = 0 (generic)
  view.setUint16(offset, workout.steps.length, true); // num_valid_steps
  offset += 2;

  // wkt_name: 16 bytes null-padded
  const rawTitle = workout.title.slice(0, 15);
  for (let i = 0; i < 16; i++) {
    view.setUint8(offset++, i < rawTitle.length ? rawTitle.charCodeAt(i) : 0);
  }

  // 4. Workout Step Definition Message (Global Msg 27)
  // Local Msg 2: Definition
  view.setUint8(offset++, 0x42); // Definition message, local msg 2
  view.setUint8(offset++, 0);
  view.setUint8(offset++, 0);
  view.setUint16(offset, 27, true); // Global Msg Number: workout_step (27)
  offset += 2;
  view.setUint8(offset++, 7);    // 7 fields

  // Field 0: message_index (uint16, 2 bytes)
  view.setUint8(offset++, 254); view.setUint8(offset++, 2); view.setUint8(offset++, 132);
  // Field 1: duration_type (enum, 1 byte): 0 = time, 1 = distance, 28 = open
  view.setUint8(offset++, 1); view.setUint8(offset++, 1); view.setUint8(offset++, 0);
  // Field 2: duration_value (uint32, 4 bytes): time in ms, distance in cm
  view.setUint8(offset++, 2); view.setUint8(offset++, 4); view.setUint8(offset++, 134);
  // Field 3: target_type (enum, 1 byte): 0 = speed (mm/s), 1 = heart_rate, 4 = open
  view.setUint8(offset++, 3); view.setUint8(offset++, 1); view.setUint8(offset++, 0);
  // Field 4: custom_target_value_low (uint32, 4 bytes): speed in mm/s or hr
  view.setUint8(offset++, 5); view.setUint8(offset++, 4); view.setUint8(offset++, 134);
  // Field 5: custom_target_value_high (uint32, 4 bytes): speed in mm/s or hr
  view.setUint8(offset++, 6); view.setUint8(offset++, 4); view.setUint8(offset++, 134);
  // Field 6: intensity (enum, 1 byte): 0 = active, 1 = rest, 2 = warmup, 3 = cooldown
  view.setUint8(offset++, 7); view.setUint8(offset++, 1); view.setUint8(offset++, 0);

  // 5. Workout Step Data Messages (for each step)
  workout.steps.forEach((step, stepIndex) => {
    view.setUint8(offset++, 0x02); // Data message, local msg 2
    view.setUint16(offset, stepIndex, true); // message_index
    offset += 2;

    // Duration type: 0 = time (ms), 1 = distance (cm)
    if (step.durationType === 'distance') {
      view.setUint8(offset++, 1); // distance
      // durationValue is in meters -> convert to cm
      view.setUint32(offset, Math.round(step.durationValue * 100), true);
      offset += 4;
    } else {
      view.setUint8(offset++, 0); // time
      // durationValue is in seconds -> convert to ms
      view.setUint32(offset, Math.round(step.durationValue * 1000), true);
      offset += 4;
    }

    // Target Type & Target Values
    if (step.targetType === 'pace' && step.targetPaceMinSecKm && step.targetPaceMaxSecKm) {
      view.setUint8(offset++, 0); // target_type = 0 (speed in mm/s)
      // Note: faster pace (lower sec/km) corresponds to higher speed (mm/s)
      // Speed in mm/s = (1000m / paceSec) * 1000 = 1,000,000 / paceSec
      const highSpeedMms = Math.round(1000000 / Math.max(1, step.targetPaceMinSecKm));
      const lowSpeedMms = Math.round(1000000 / Math.max(1, step.targetPaceMaxSecKm));
      view.setUint32(offset, lowSpeedMms, true);
      offset += 4;
      view.setUint32(offset, highSpeedMms, true);
      offset += 4;
    } else if (step.targetType === 'hr_zone' && step.targetHrZone) {
      view.setUint8(offset++, 1); // target_type = 1 (heart rate)
      view.setUint32(offset, step.targetHrZone, true);
      offset += 4;
      view.setUint32(offset, step.targetHrZone, true);
      offset += 4;
    } else {
      view.setUint8(offset++, 4); // target_type = 4 (open)
      view.setUint32(offset, 0, true);
      offset += 4;
      view.setUint32(offset, 0, true);
      offset += 4;
    }

    // Intensity: 0 = active, 1 = rest, 2 = warmup, 3 = cooldown
    let intensity = 0;
    if (step.stepType === 'warmup') intensity = 2;
    else if (step.stepType === 'cooldown') intensity = 3;
    else if (step.stepType === 'recovery') intensity = 1;
    else intensity = 0;

    view.setUint8(offset++, intensity);
  });

  const dataEnd = offset;
  const dataSize = dataEnd - dataStart;

  // Write actual dataSize into header
  view.setUint32(dataSizeOffset, dataSize, true);

  // Compute CRC16 over the whole file (header + data)
  const fileCrc = computeCrc16(bytes, 0, offset);
  view.setUint16(offset, fileCrc, true);
  offset += 2;

  return bytes.slice(0, offset);
}

/**
 * Initiates browser download of the generated Garmin FIT workout file
 */
export function downloadGarminFitFile(workout: PlannedWorkout): void {
  const fitBytes = generateGarminFitWorkout(workout);
  const blob = new Blob([fitBytes.buffer.slice(0, fitBytes.byteLength) as ArrayBuffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // Clean safe filename
  const cleanName = workout.title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
  a.download = `${cleanName}.fit`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
