const fs = require('fs');
const path = require('path');

const gradlePath = path.resolve(__dirname, '../mobile/android/app/build.gradle');

if (!fs.existsSync(gradlePath)) {
  console.error(`❌ build.gradle not found at ${gradlePath}`);
  process.exit(1);
}

let content = fs.readFileSync(gradlePath, 'utf8');

const releaseSigningConfig = `
        release {
            storeFile file('campusmind-release.keystore')
            storePassword 'campusmind123'
            keyAlias 'campusmind'
            keyPassword 'campusmind123'
        }
`;

// Inject into signingConfigs block
if (content.includes('signingConfigs {')) {
  content = content.replace('signingConfigs {', `signingConfigs {${releaseSigningConfig}`);
} else {
  console.warn('⚠️ signingConfigs block not found in build.gradle');
}

// Ensure release buildType uses signingConfigs.release
const oldReleaseSignature = /signingConfig\s+signingConfigs\.debug/g;
if (oldReleaseSignature.test(content)) {
  content = content.replace(oldReleaseSignature, 'signingConfig signingConfigs.release');
  console.log('✅ Replaced signingConfig signingConfigs.debug with signingConfigs.release');
} else {
  console.log('ℹ️ signingConfig signingConfigs.release might already be configured');
}

fs.writeFileSync(gradlePath, content, 'utf8');
console.log('✅ Successfully configured release keystore in mobile/android/app/build.gradle');
