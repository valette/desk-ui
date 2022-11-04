/**
 * Base Xterm container, used by Logger ant Terminal classes
 */

qx.Class.define("desk.Xterm.Container", {

	extend : qx.ui.core.Widget,

    /**
    * Constructor
    */
	construct : function () {

		this.base(arguments);
		this.setBackgroundColor( "black" );
		const term = require( 'xterm' ).Terminal;
		this._terminal = new term( { scrollback : 100000 } );
		this.addListenerOnce( 'appear', this.__onAppear, this );

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

		_terminal : null,
		__nCols : null,
		__nRows : null,

		__onAppear : function () {

			this.addListener( 'resize', this.__onResize, this );
			const fit = require ( "xterm-addon-fit" ).FitAddon;
			const fitAddon = this.__fitAddon = new fit();
			this._terminal.loadAddon( fitAddon );
			const element = this.getContentElement().getDomElement();
			this._terminal.open( element, { focus : true } );
			this.__onResize();

		},

		__onResize : async function () {

			await new Promise( res => setTimeout( res, 2 ) );
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

		}

	}

});
