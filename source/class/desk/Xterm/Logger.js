/**
 * A log container
 */

qx.Class.define("desk.Xterm.Logger", {

	extend : qx.ui.embed.Html,

    /**
    * Constructor
    */
	construct : function () {

		this.base(arguments);
		this._rand = Math.floor( 100000000 * Math.random());
		this.setBackgroundColor( "black" );
		this.setHtml( '<div style="width: 100%; height: 100%" id = "' + this._rand + '"></div>' );
		const term = require( 'xterm' ).Terminal;
		this._terminal = new term( { scrollback : 100000 } );
		this.addListenerOnce( 'appear', this.__onAppear, this );
		this.__chalk = new ( require( 'chalk' ).Instance )( { level: 3 } );

	},

	destruct : function () {

		this._terminal.dispose();

	},

	events : {
		/**
		* Fired whenever the number of rows or columns changes
		*/
		"resizeTerminal" : "qx.event.type.Data"
	},

	members : {

		_rand : null, // random number
		_terminal : null,
		__chalk : null,

		__onAppear : function () {

			const container = document.getElementById( '' + this._rand );
			this.addListener( 'resize', this.__onResize, this );
			this.__onResize();
			const fit = require ( "xterm-addon-fit" ).FitAddon;
			const fitAddon = this.__fitAddon = new fit();
			this._terminal.loadAddon(fitAddon);
			this._terminal.open( container, { focus : true } );

		},

		__onResize : async function () {

			if ( !this.isVisible() ) return;
			await new Promise ( res => setTimeout( res, 2 ) );
			this.__fitAddon.fit();
			const nCols = this._terminal.cols;
			const nRows = this._terminal.rows;

			if ( ( this.__nCols == nCols ) && ( this.__nRows === nRows) )
				return;

			this.__nCols = nCols;
			this.__nRows = nRows;
			this.debug('resize : ', nCols, nRows);
			this._terminal.focus();
			this.fireDataEvent( 'resizeTerminal', { nCols, nRows } );
		},

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
