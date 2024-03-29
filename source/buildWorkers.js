var fs = require('fs');

//Got list from https://github.com/rii-mango/Papaya-Builder/blob/master/src/edu/uthscsa/ric/papaya/builder/Builder.java
const files =  [
  //"../Papaya/lib/daikon.js",
  //"../Papaya/lib/base64-binary.js",
  //"node_modules/papaya-viewer/lib/bowser.js",
  //"../Papaya/lib/numerics.js",
  "node_modules/papaya-viewer/lib/pako-inflate.js",
  "node_modules/papaya-viewer/lib/nifti-reader.js",
  //"../Papaya/lib/gifti-reader.js",
  //"../Papaya/lib/gl-matrix.js",
  //"../Papaya/lib/GLU.js",
  "node_modules/papaya-viewer/src/js/constants.js",
  "node_modules/papaya-viewer/src/js/utilities/array-utils.js",
  "node_modules/papaya-viewer/src/js/utilities/math-utils.js",
  "node_modules/papaya-viewer/src/js/utilities/object-utils.js",
  "node_modules/papaya-viewer/src/js/utilities/platform-utils.js",
  "node_modules/papaya-viewer/src/js/utilities/string-utils.js",
  //"../Papaya/src/js/utilities/url-utils.js",
  "node_modules/papaya-viewer/src/js/core/coordinate.js",
  "node_modules/papaya-viewer/src/js/core/point.js",
  "node_modules/papaya-viewer/src/js/volume/header.js",
  "node_modules/papaya-viewer/src/js/volume/imagedata.js",
  "node_modules/papaya-viewer/src/js/volume/imagedescription.js",
  "node_modules/papaya-viewer/src/js/volume/imagedimensions.js",
  "node_modules/papaya-viewer/src/js/volume/imagerange.js",
  "node_modules/papaya-viewer/src/js/volume/imagetype.js",
  "node_modules/papaya-viewer/src/js/volume/nifti/header-nifti.js",
  //"../Papaya/src/js/volume/dicom/header-dicom.js",
  "node_modules/papaya-viewer/src/js/volume/orientation.js",
  "node_modules/papaya-viewer/src/js/volume/transform.js",
  "node_modules/papaya-viewer/src/js/volume/volume.js",
  "node_modules/papaya-viewer/src/js/volume/voxeldimensions.js",
  "node_modules/papaya-viewer/src/js/volume/voxelvalue.js",
  //"../Papaya/src/js/surface/surface.js",
  //"../Papaya/src/js/surface/surface-gifti.js",
  //"../Papaya/src/js/surface/surface-mango.js",
  //"../Papaya/src/js/surface/surface-vtk.js",
  __dirname + "/ext/workerSlicer.manager.js"];

function concat( files, outputFile ) {
	const output = files.map( f => fs.readFileSync( f ).toString() ).join( ';' );
	fs.writeFileSync( outputFile,output, "utf8");
}

concat( files, __dirname + "/resource/desk/workers/SlicerWorker.js" );

const files2 = [
__dirname + "/ext/lzma.js",
__dirname +"/ext/ctm.js",
__dirname + "/ext/CTMWorker.js"
]

concat( files2, __dirname + "/resource/desk/workers/CTMWorkerBundle.js" );
