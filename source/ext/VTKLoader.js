/**
 * Loader for VTK encoded models
 *
 * @author mrdoob / http://mrdoob.com/
 * @author alteredq / http://alteredqualia.com/
 */

const workers = [];


class Model extends THREE.BufferGeometry {

	constructor ( data ) {

		super();
		var indices = data.indices,
		positions = data.positions,
		normals = data.normals;

		var uvs, colors;

		var uvMaps = data.uvMaps;

		if ( uvMaps !== undefined && uvMaps.length > 0 ) {

			uvs = uvMaps[ 0 ].uv;

		}

		var attrMaps = data.attrMaps;

		if ( attrMaps !== undefined && attrMaps.length > 0 && attrMaps[ 0 ].name === 'Color' ) {

			colors = attrMaps[ 0 ].attr;

		}

		this.setIndex( new THREE.BufferAttribute( indices, 1 ) );
		this.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );

		if ( normals !== undefined ) {

			this.setAttribute( 'normal', new THREE.BufferAttribute( normals, 3 ) );

		}

		if ( uvs !== undefined ) {

			this.setAttribute( 'uv', new THREE.BufferAttribute( uvs, 2 ) );

		}

		if ( colors !== undefined ) {

			this.setAttribute( 'color', new THREE.BufferAttribute( colors, 4 ) );

		}

	}

}


class VTKLoader extends THREE.Loader {

	constructor( showStatus )  {

		super( showStatus );

	}

	createWorker() {

		const manager = qx.util.ResourceManager.getInstance();
		const url = manager.toUri( "desk/workers/VTKWorker.js");
		return new Worker( url );

	}


// Load VTK models
//	- parameters
//		- url (required)
//		- callback (required)
	load ( url, callback, parameters ) {

		parameters = parameters || {};

		var scope = this;

		var offsets = parameters.offsets !== undefined ? parameters.offsets : [ 0 ];

		var xhr = new XMLHttpRequest(),
			callbackProgress = null;

		var length = 0;

		xhr.onreadystatechange = function() {

			if ( xhr.readyState === 4 ) {

				if ( xhr.status === 200 || xhr.status === 0 ) {

					var s = Date.now();

					if ( parameters.useWorker != false ) {

						var worker = workers.shift() || scope.createWorker();

						worker.onmessage = function( event ) {

							var e1 = Date.now();
	//						console.log( "VTK data parse time [worker]: " + (e1-s) + " ms" );

							scope.createModel( event.data, callback );

							var e = Date.now();
	//						console.log( "model load time [worker]: " + (e-e1) + " ms, total: " + (e-s));

							workers.push(worker);

						};

						worker.postMessage(xhr.responseText);

					} else {

						scope.createModel(scope.parse(xhr.response), callback);

					}

				} else {

					console.error( "Couldn't load [" + url + "] [" + xhr.status + "]" );

				}

			} else if ( xhr.readyState === 3 ) {

				if ( callbackProgress ) {

					if ( length === 0 ) {

						length = xhr.getResponseHeader( "Content-Length" );

					}

					callbackProgress( { total: length, loaded: xhr.responseText.length } );

				}

			} else if ( xhr.readyState === 2 ) {

				//length = xhr.getResponseHeader( "Content-Length" );

			}

		}

		xhr.open( "GET", url, true );

		xhr.send( null );

	}

	createModel( data, callback ) {


		var geometry = new Model( data );

		// compute vertex normals if not present in the model
		if ( geometry.attributes[ "normal" ] === undefined ) {

			geometry.computeVertexNormals();

		}

		if (data.pointData) {

			geometry.userData = {pointData : data.pointData};

		}

		callback( geometry );

	}

	parse( data ) {

		var payload = {};

		var i, pattern, pattern2, result, nV, numV, numP;

		pattern = /POINTS[\s]+([\d]+)/g;
		result = pattern.exec( data );
		numV = parseInt(result[1], 10);
		// float/int  float/int  float/int
		pattern2 = /([\+|\-]?[\d]+[\.]?[\d|\-|e]*)[ ]+([\+|\-]?[\d]+[\.]?[\d|\-|e]*)[ ]+([\+|\-]?[\d]+[\.]?[\d|\-|e]*)/g;
		pattern2.lastIndex = pattern.lastIndex;

		var positions = payload.positions = new Float32Array( numV * 3 );

		nV = numV;
		i = 0;

		while ( nV--) {

			result = pattern2.exec( data );
			positions[i++] = parseFloat( result[ 1 ] );
			positions[i++] = parseFloat( result[ 2 ] );
			positions[i++] = parseFloat( result[ 3 ] );

		}

		pattern = /POLYGONS[\s]+([\d]+)[\s]([\d]+)/g;
		result = pattern.exec( data );
		numP = parseInt(result[1], 10);

		// 3 int int int
		pattern2 = /3[ ]+([\d]+)[ ]+([\d]+)[ ]+([\d]+)/g;
		pattern2.lastIndex = pattern.lastIndex;

		var indices = payload.insices = new Uint32Array( numP * 3 );

		var j = 0;

		for (i = 0; i < numP; i++) {

			// ["3 1 2 3", "1", "2", "3"]
			result = pattern2.exec( data );
			indices[j++] = parseInt( result[ 1 ] );
			indices[j++] = parseInt( result[ 2 ] );
			indices[j++] = parseInt( result[ 3 ] );

		}

		pattern = /POINT_DATA[\s]([\d]+)/g;
		result = pattern.exec( data );
		if (result) {

			if ( numV !== parseInt(result[1], 10)) {

				return;

			}

			pattern2 = /SCALARS[\s][\x21-\x7E]+[\s][\x21-\x7E]+/g;
			pattern2.lastIndex = pattern.lastIndex;
			result = pattern2.exec( data );

			pattern =/LOOKUP_TABLE[\s][\x21-\x7E]+/;
			pattern.lastIndex = pattern2.lastIndex;
			result = pattern.exec( data );

			pattern2 = /[\s]*([\-\+]?[0-9]*[\.]?[0-9]+)/g;
			pattern2.lastIndex = pattern.lastIndex;

			var pointData = new Float32Array(numV);

			for  (i = 0; i < numV; i++) {

				result = pattern2.exec( data );
				pointData[i] = parseFloat(result[1], 10);

			}

			geometry.userData = geometry.userData || {};
			geometry.userData.pointData = pointData;

		}

		return (payload);
	}

}

THREE.VTKLoader = VTKLoader;

