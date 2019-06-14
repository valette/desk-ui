
node source/build-worker.js

cp source/script/*.js build/desk-ui
cp source/script/*.js source-output/desk-ui

cp icon.* build
cp splash.* build
cp script.js build
cp package.json build
cp -r source/resource/ife source-output/resource/ife
cp -r source/resource/ife build/resource/ife

cd build
npm install --production
cd ..
