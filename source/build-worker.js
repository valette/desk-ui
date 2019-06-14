var fs = require('fs');

//Got list from https://github.com/rii-mango/Papaya-Builder/blob/master/src/edu/uthscsa/ric/papaya/builder/Builder.java
var js_files =  [
  //"../Papaya/lib/daikon.js",
  //"../Papaya/lib/base64-binary.js",
  //"Papaya/lib/bowser.js",
  //"../Papaya/lib/numerics.js",
  "Papaya/lib/pako-inflate.js",
  "Papaya/lib/nifti-reader.js",
  //"../Papaya/lib/gifti-reader.js",
  //"../Papaya/lib/gl-matrix.js",
  //"../Papaya/lib/GLU.js",
  "Papaya/src/js/constants.js",
  "Papaya/src/js/utilities/array-utils.js",
  "Papaya/src/js/utilities/math-utils.js",
  "Papaya/src/js/utilities/object-utils.js",
  //"Papaya/src/js/utilities/platform-utils.js",
  "Papaya/src/js/utilities/string-utils.js",
  //"../Papaya/src/js/utilities/url-utils.js",
  "Papaya/src/js/core/coordinate.js",
  "Papaya/src/js/core/point.js",
  "Papaya/src/js/volume/header.js",
  "Papaya/src/js/volume/imagedata.js",
  "Papaya/src/js/volume/imagedescription.js",
  "Papaya/src/js/volume/imagedimensions.js",
  "Papaya/src/js/volume/imagerange.js",
  "Papaya/src/js/volume/imagetype.js",
  "Papaya/src/js/volume/nifti/header-nifti.js",
  //"../Papaya/src/js/volume/dicom/header-dicom.js",
  "Papaya/src/js/volume/orientation.js",
  "Papaya/src/js/volume/transform.js",
  "Papaya/src/js/volume/volume.js",
  "Papaya/src/js/volume/voxeldimensions.js",
  "Papaya/src/js/volume/voxelvalue.js",
  //"../Papaya/src/js/surface/surface.js",
  //"../Papaya/src/js/surface/surface-gifti.js",
  //"../Papaya/src/js/surface/surface-mango.js",
  //"../Papaya/src/js/surface/surface-vtk.js",
  "source/workerSlicer.manager.js"];

var output = js_files.map((f)=>{
  return fs.readFileSync(f).toString();
}).join(';')

fs.writeFileSync("source/ext/workerSlicer.worker.js",output, "utf8");

