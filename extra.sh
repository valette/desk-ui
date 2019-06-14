
cp icon.* build
cp splash.* build
cp script.js build
cp package.json build
cp -r source/resource/ife source-output/resource/ife
cp -r source/resource/ife build/resource/ife

cd build
npm install --production
cd ..
