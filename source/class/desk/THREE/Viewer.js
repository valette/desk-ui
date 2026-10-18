/**
 * A Standalone viewer. It it simply a desk.THREE.Container embeded in a window
*/
qx.Class.define("desk.THREE.Viewer", 
{
	extend : desk.THREE.Container,
	include : desk.WindowMixin,

	statics : {
		/**
		 * If true, meshes are converted to the legacy OpenCTM format
		 * (mesh2ctm -> mesh.ctm) before loading instead of the default
		 * Draco format (draco_encoder -> mesh.drc).
		 */
		USE_LEGACY_CTM : false
	},

	construct : function(file, parameters, callback, context) {
        this.base(arguments, file, parameters, callback, context);
	}
});
