/**
 * A log container
 */

qx.Class.define("desk.Xterm.Logger", {

	extend : desk.Xterm.Container,

    /**
    * Constructor
    */
	construct : function () {

		this.base(arguments);
		this.__chalk = new ( require( 'chalk' ).Instance )( { level: 3 } );

	},

	members : {

		__chalk : null,

		/**
		* Clears the log contents
		*/
		clear : function () {

			this._terminal.clear();

		},

		/**
		* Add log message
		* @param message {String} message to display
		* @param color {String} optional message color
		*/
		log : function ( message, color ) {

			if ( color ) message = this.__chalk[color]( message );
			const lines = message.split( '\n' );
			const lastLine = lines.pop();
			for ( let line of lines ) this._terminal.writeln( line );
			this._terminal.write( lastLine );
			this._terminal.scrollToBottom();

		}

	}

});
