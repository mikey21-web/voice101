import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const assets = [
  // Gallery images
  'https://zenvistas.spimproject.com/assets/gallery/type_1.webp',
  'https://zenvistas.spimproject.com/assets/gallery/type_2.webp',
  'https://zenvistas.spimproject.com/assets/gallery/type_3.webp',
  'https://zenvistas.spimproject.com/assets/gallery/pillar_1.webp',
  'https://zenvistas.spimproject.com/assets/gallery/pillar_2.webp',
  'https://zenvistas.spimproject.com/assets/gallery/pillar_3_seam_living.webp',
  'https://zenvistas.spimproject.com/assets/gallery/pillar_4_home_gen.webp',
  'https://zenvistas.spimproject.com/assets/gallery/pillar_5_proption.webp',
  'https://zenvistas.spimproject.com/assets/gallery/study_space.webp',
  'https://zenvistas.spimproject.com/assets/gallery/pool.webp',
  'https://zenvistas.spimproject.com/assets/gallery/hall.webp',
  'https://zenvistas.spimproject.com/assets/gallery/gym.webp',
  'https://zenvistas.spimproject.com/assets/gallery/clubhouse_top_view.webp',
  'https://zenvistas.spimproject.com/assets/gallery/boardroom.webp',
  'https://zenvistas.spimproject.com/assets/gallery/billards.webp',
  'https://zenvistas.spimproject.com/assets/gallery/zen_garden.webp',
  'https://zenvistas.spimproject.com/assets/gallery/working_pod.webp',
  'https://zenvistas.spimproject.com/assets/gallery/swing_park.webp',
  'https://zenvistas.spimproject.com/assets/gallery/multipurpose_court.webp',
  'https://zenvistas.spimproject.com/assets/gallery/lawn.webp',
  'https://zenvistas.spimproject.com/assets/gallery/jogging_park.webp',
  'https://zenvistas.spimproject.com/assets/gallery/cricket_pitch.webp',
  'https://zenvistas.spimproject.com/assets/gallery/childern_area.webp',
  'https://zenvistas.spimproject.com/assets/gallery/central_vistas.webp',
  // Map-related assets
  'https://zenvistas.spimproject.com/assets/Zen_Vistas_Map.png',
  'https://zenvistas.spimproject.com/assets/markers/Zenvistas_Mappin.png',
  'https://zenvistas.spimproject.com/assets/markers/default_marker_pin.png',
  'https://zenvistas.spimproject.com/assets/map_images/kmch_medical_college.webp',
  'https://zenvistas.spimproject.com/assets/map_images/coimbatore_institute_of_technology.webp',
  'https://zenvistas.spimproject.com/assets/map_images/dr.g.r.damodaran_college_of_science.webp',
  'https://zenvistas.spimproject.com/assets/map_images/grd_public_school.webp',
  'https://zenvistas.spimproject.com/assets/map_images/psg_college_of_arts_and_science.webp',
  'https://zenvistas.spimproject.com/assets/map_images/nsp_institution_of_arts_and_science.webp',
  'https://zenvistas.spimproject.com/assets/map_images/chandrakanti_public_school.webp',
  'https://zenvistas.spimproject.com/assets/map_images/psg_public_school.webp',
  'https://zenvistas.spimproject.com/assets/map_images/pallikoodam_rak.webp',
  'https://zenvistas.spimproject.com/assets/map_images/suguna_pip_school.webp',
  'https://zenvistas.spimproject.com/assets/map_images/sri_vivekananda_matric.webp',
  'https://zenvistas.spimproject.com/assets/map_images/cbse_school_(reeds).webp',
  'https://zenvistas.spimproject.com/assets/map_images/tidel_park.webp',
  'https://zenvistas.spimproject.com/assets/map_images/cognizant.webp',
  'https://zenvistas.spimproject.com/assets/map_images/bosch_global_software.webp',
  'https://zenvistas.spimproject.com/assets/map_images/kgisl_campas.webp',
  'https://zenvistas.spimproject.com/assets/map_images/funmall.webp',
  'https://zenvistas.spimproject.com/assets/map_images/prozone.webp',
  'https://zenvistas.spimproject.com/assets/map_images/broadway_cinemas.webp',
  'https://zenvistas.spimproject.com/assets/map_images/dmart_singanallur.webp',
  'https://zenvistas.spimproject.com/assets/map_images/dmart _chinniyampalayam.webp',
  'https://zenvistas.spimproject.com/assets/map_images/dmart_sulur.webp',
  'https://zenvistas.spimproject.com/assets/map_images/kmch_medical.webp',
  'https://zenvistas.spimproject.com/assets/map_images/lotus_eye_care.webp',
  'https://zenvistas.spimproject.com/assets/map_images/yazhini_hospital.webp',
  'https://zenvistas.spimproject.com/assets/map_images/rg_hospital.webp',
  'https://zenvistas.spimproject.com/assets/map_images/venkateshwara_hospital.webp',
  'https://zenvistas.spimproject.com/assets/map_images/reya_are.webp',
  'https://zenvistas.spimproject.com/assets/map_images/coimbatore_railway_junction.webp',
  'https://zenvistas.spimproject.com/assets/map_images/peelamedu_rail_station.webp',
  'https://zenvistas.spimproject.com/assets/map_images/kaniyur_toll_gate.webp',
  'https://zenvistas.spimproject.com/assets/map_images/singanallur_bus_stand.webp',
  'https://zenvistas.spimproject.com/assets/map_images/gandhipuram_bus_stand.webp',
  'https://zenvistas.spimproject.com/assets/map_images/ooty.webp',
  'https://zenvistas.spimproject.com/assets/map_images/kotagiri.webp',
  'https://zenvistas.spimproject.com/assets/map_images/pollachi.webp',
];

function download(url) {
  return new Promise(resolve => {
    const relPath = url.replace('https://zenvistas.spimproject.com/', '');
    const fullPath = path.join(__dirname, relPath);
    const dir = path.dirname(fullPath);
    fs.mkdirSync(dir, { recursive: true });
    const file = fs.createWriteStream(fullPath);
    https.get(url, response => {
      if (response.statusCode === 404) {
        file.close();
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        console.log(`  ❌ 404: ${relPath}`);
        resolve(false);
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        const stats = fs.statSync(fullPath);
        console.log(`  ✅ ${relPath} (${(stats.size / 1024).toFixed(1)} KB)`);
        resolve(true);
      });
    }).on('error', err => {
      file.close();
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      console.log(`  ❌ Error: ${relPath} - ${err.message}`);
      resolve(false);
    });
  });
}

async function main() {
  console.log('Downloading additional assets...\n');
  let success = 0, fail = 0;
  for (const url of assets) {
    const ok = await download(url);
    if (ok) success++; else fail++;
  }
  console.log(`\nDone: ${success} downloaded, ${fail} failed`);
}

main().catch(console.error);
