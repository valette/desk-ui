npm install

rm -rf EduAnat2-*

mkdir dist

node source/build-worker.js

mkdir build/
cd build/
mkdir script
cd ..

cp icon.* build

cp source/script/workerSlicer.class.js build/script/workerSlicer.class.js
cp source/script/workerSlicer.worker.min.js build/script/workerSlicer.worker.min.js
cp splash.png build/splash.png
cp splash.html build/splash.html
cp icone_eduanat2.png build/icone_eduanat2.png
cp script.js build/script.js
cp index.html build/index.html
cp package.json build/package.json

cp source/script/test.js build/script/test.js
cp source/script/STLLoader.js build/script/STLLoader.js
cp -r source/resource/ build

#browserify (without -g npm install)
node node_modules/browserify/bin/cmd.js source/browserified.js -r async -r heap -r jstat -r lodash -r operative -r ./source/desk-client.js:desk-client > source/script/bundle.js

cp source/script/bundle.js build/script/bundle.js

python generate.py source && python generate.py build

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
