/**
 * Singleton helper class for parsing URL parameters
 */

qx.Class.define("desk.URLParameters", 
{
	extend : qx.core.Object,

	type : "singleton",

	construct : function() {},

	statics : {

        /**
		* returns the URL provided parameter if it exists
		* e.g. : www.myadress.com/desk/?myParam=hello
		* @param parameterName {String} parameter name
		* @return {String} file extension
		*/
		getParameter : function ( parameterName ) {

			parameterName = parameterName.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
			const regex = new RegExp( "[\\?&]" + parameterName + "=([^&#]*)" );
			const results = regex.exec( window.location.href );
			if (results != null) return results[ 1 ];

		},

        /**
		* modify the parameters object with URL parameters when provided.
		* Can parse strings, floats and arrays.
		* @param params {Object} parameters
		*/
		parseParameters : function ( params ) {

			for ( let [ key, value ] of Object.entries( params ) ) {

				let newValue = desk.URLParameters.getParameter( key );
				if ( newValue === undefined ) continue;

				if ( !isNaN( value ) )
					newValue = parseFloat( newValue );
				else if ( Array.isArray( value ) )
					newValue = newValue.split( "," ).map( v =>
						isNaN( v ) ? v : parseFloat( v ) );

				params[ key ] = newValue;

			}

			if ( desk.URLParameters.getParameter( "help" ) == true )
				alert( "Current parameters: \n"
					+ Object.entries( params ).map( e => e.join( ": " ) )
						.join( '\n' ) );

		}

	}
});
