/**
 * 
 * Singleton helper class for mesh loading
 * @ignore (async.*)
 * @ignore(THREE.*)
 */

qx.Class.define("desk.THREE.Loader", 
{
	extend : qx.core.Object,

	type : "singleton",

	/**
	*  Constructor
	*/

	construct : function() {

		const concurrency = navigator?.hardwareConcurrency || 4;
		this.__CTMqueue = async.queue( this.__CTMLoad.bind( this ), concurrency );

	},

	statics : {
		/**
		* Loads a Geometry from a file.
		*
		* @param url {String} the geometry file to load
		* @param options {Object} options which can be : 
		* <pre class='javascript'>
		* { <br>
		*   compress : true/false // enable/disable cache (false by default) <br>
		*   timeStamp : number // to ease caching <br>
		* }
		* </pre>
		*/
		loadGeometry : async function ( file, opts = {} ) {

			const { compress = true, timeStamp } = opts;
			const self = desk.THREE.Loader.getInstance();
			const extension = file.split( "." ).pop().toLowerCase();

			if ( compress || !self.__availableLoaders[ extension ] ) {

				const convert = await desk.Actions.executeAsync( {
					"action" : "mesh2ctm",
					"input_mesh" : file
				} );

				opts = { timeStamp : convert.timeStamp, ...opts };
				file = convert.outputDirectory + "mesh.ctm";

			}

			const url = desk.FileSystem.getFileURL( file );
			return await desk.THREE.Loader.loadGeometryURL( url, opts );

		},

		/**
		* Loads a Geometry from a URL.
		*
		* @param url {String} the geometry url
		* @param options {Object} options which can be : 
		* <pre class='javascript'>
		* { <br>
		*   timeStamp : number // to ease caching <br>
		* }
		* </pre>
		*/
		loadGeometryURL : async function ( url, opts = {} ) {

			const { timeStamp = Math.random() } = opts;
			const extension = url.split( "." ).pop().toLowerCase();
			const self = desk.THREE.Loader.getInstance();
			url += "?nocache=" + timeStamp;
			if ( extension == "ctm" ) return await self.__CTMqueue.push( url );
			const loader = new ( THREE[ self.__availableLoaders[ extension ] ] )();
			return await new Promise( res => loader.load( url, res ) );

		},

		/**
		* Loads a Mesh.
		*
		* @param file {String} the mesh to load
		* @param options {Object} options which can be : 
		* <pre class='javascript'>
		* { <br>
		*   opacity : 1 // mesh opacity <br>
		*   color : [1, 1, 1] // mesh color <br>
		*   renderOrder : 0 // mesh render order <br>
		*   timeStamp : number // to ease caching <br>
		* }
		* </pre>
		*/
		loadMesh : async function ( file, opts = {} ) {

			const geometry = await desk.THREE.Loader.loadGeometry( file, opts );
			if ( geometry.isObject3D ) return geometry; // OBJLoader returns a THREE.Group
			geometry.computeBoundingBox();
			const { opacity = 1, color = [ 1, 1, 1 ], renderOrder = 0 } = opts;

			const material =  new THREE.MeshLambertMaterial({
				color : new THREE.Color().fromArray( color ).getHex(),
				side : THREE.DoubleSide
			});

			material.opacity = opacity;
			if ( opacity < 1 ) material.transparent = true;
			const mesh = new THREE.Mesh( geometry, material );
			if ( geometry?.attributes?.color ) mesh.material.vertexColors = true;
			mesh.renderOrder = renderOrder;
			return mesh;

		}

	},

	members : {

		__availableLoaders : {

			"ctm" : "CTMLoader",
			"obj" : "OBJLoader",
			"ply" : "PLYLoader",
			"stl" : "STLLoader",
			"vtk" : "VTKLoader"

		},

		__CTMworkers : [],

		/**
		 * (really) loads ctm mesh url
		 * @param url {String} url to load
		 */
		 __CTMLoad : async function ( url ) {

			let worker = this.__CTMworkers.shift();

			if ( !worker ) {

				const manager = qx.util.ResourceManager.getInstance();
				const url = manager.toUri( "desk/workers/CTMWorkerBundle.js");
				worker = new window.Worker( url );

			}

			const geometry = await new Promise( res =>
				( new THREE.CTMLoader()).load( url, res, { useWorker : true, worker } ) );

			this.__CTMworkers.push( worker );
			return geometry;

		}

	}

});
