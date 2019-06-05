npm install

rm -rf build
rm -rf dist
rm -rf EduAnat2-*

mkdir dist
mkdir build


npm run qooxdoo
npm run bundle
node source/build-worker.js

cp icon.* build
cp source/script/workerSlicer.class.js build/desk-ui
cp source/script/workerSlicer.worker.js build/desk-ui
cp source/script/workerSlicer.class.js source-output/desk-ui
cp source/script/workerSlicer.worker.js source-output/desk-ui
cp splash.png build
cp splash.html build
cp icone_eduanat2.png build
cp script.js build
cp package.json build
cp -r source/resource/ife source-output/resource/ife

cp source/script/test.js build/desk-ui
cp source/script/test.js source-output/desk-ui
cp source/script/STLLoader.js build/desk-ui
cp -r source/resource/ build

cd build
npm install  --production
cd ..

#Create flat build (folder : win32, win64, linux64, mac64)
node node_modules/electron-packager/cli.js --overwrite --icon=icon.ico --azar=true --app-version=2.0.0 --arch ia32 --platform win32 build/ EduAnat2
node node_modules/electron-packager/cli.js --overwrite --icon=icon.ico --azar=true --app-version=2.0.0 --arch ia32 --platform linux build/ EduAnat2
node node_modules/electron-packager/cli.js --overwrite --icon=icon.ico --azar=true --app-version=2.0.0 --arch x64 --platform linux build/ EduAnat2
node node_modules/electron-packager/cli.js --overwrite --icon=icon.ico --azar=true --app-version=2.0.0 --arch x64 --platform darwin build/ EduAnat2
for i in ./EduAnat2-*; do zip -rqy "dist/${i%/}.zip" "$i"; done

#Create packaged build (win64 : .exe installer, linux : .deb)
node node_modules/electron-builder/out/cli/cli.js build -wl --config builder-effective-config.yaml
