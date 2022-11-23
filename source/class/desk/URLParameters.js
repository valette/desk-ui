/**
 * Singleton helper class for parsing URL parameters
 */

qx.Class.define("desk.URLParameters", 
{
	extend : qx.core.Object,

	type : "singleton",

	construct : function() {

		const href = window.location.href;
		const split = href.split( "?" );
		if ( split.length < 2 ) return;
		const line = split.pop();

		for ( let param of line.split( "&" ) ) {

			let [ name, value ] = param.split( "=" );
			try { value = JSON.parse( value ); } catch( e ) {}
			desk.URLParameters.parameters[ name ] = value;

		}

	},

	statics : {

		parameters : {},

        /**
		* returns the URL provided parameter if it exists
		* e.g. : www.myadress.com/desk/?myParam=hello
		* @param bame {String} parameter name
		* @return {String} file extension
		*/
		getParameter : function ( name ) {

			return desk.URLParameters.parameters[ name ];

		},

        /**
		* modify the parameters object with URL parameters when provided.
		* Can parse strings, booleans, floats and arrays.
		* @param params {Object} parameters
		*/
		parseParameters : function ( params ) {

			function parse( value ) {

				let parsed = value;
				try { parsed = JSON.parse( value ); } catch( e ) {}
				return parsed;

			}

			const names = Object.keys( params );

			for ( let [ key, value ] of Object.entries( desk.URLParameters.parameters ) ) {

				if ( !names.includes( key ) ) {
					console.warn( "Parameter " + key + " is not a proposed parameter" );
					continue;
				}

				let oldValue = params[ key ];

				if ( Array.isArray( oldValue ) && !Array.isArray( value ) )
					value = value.split( "," ).map( parse );

				params[ key ] = value;

			}

			console.log( "URL parameters : " );
			console.log( params );

			if ( desk.URLParameters.getParameter( "help" ) == true )
				alert( "Current parameters: \n"
					+ Object.entries( params ).map( e => e.join( ": " ) )
						.join( '\n' ) );

		}

	}
});
