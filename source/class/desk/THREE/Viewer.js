/**
 * A Standalone viewer. It it simply a desk.THREE.Container embeded in a window
*/
qx.Class.define("desk.THREE.Viewer", 
{
	extend : desk.THREE.Container,
	include : desk.WindowMixin,

	construct : function(file, parameters, callback, context) {
        this.base(arguments, file, parameters, callback, context);
	}
});
