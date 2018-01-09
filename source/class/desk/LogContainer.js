/**
 * A log container
 * @ignore(Terminal)
 * @ignore(require)
 */
qx.Class.define("desk.LogContainer", {

	extend : qx.ui.embed.Html,

    /**
    * Constructor
    */
	construct : function () {

		this.base(arguments);
		this.__rand = Math.floor( 100000000 * Math.random());
		this.setHtml( '<div id = "' + this.__rand + '"></div>' );
		this.__terminal = new Terminal();
		this.addListenerOnce( 'appear', this.__onAppear, this );
		this.__chalk = new ( require( 'chalk' ).constructor )( { level: 3 } );

	},

	destruct : function () {

		this.__terminal.destroy();

	},

members : {

	__rand : null, // random number
	__terminal : null,
	__chalk : null,
	__colors : {},

	__onAppear : function () {

		var container = document.getElementById( '' + this.__rand );
		this.__terminal.open( container, { focus : true } );
		this.addListener( 'resize', this.__onResize, this );
		this.__onResize();

	},

	__onResize : function () {

		var size = this.getInnerSize();
		var nCols = Math.floor( size.width / 8.5 );
		var nRows = Math.floor( size.height / 17 );
		this.debug('resize : ', nCols, nRows);
		this.__terminal.resize( nCols, nRows );
		this.__terminal.refresh();

	},

    /**
    * Clears the log contents
    */
    clear : function () {

		this.__terminal.clear();

	},

    /**
    * Add log message
    * @param message {String} message to display
    * @param color {String} optional message color
    */
    log : function ( message, color ) {

		if ( color ) message = this.__chalk.keyword( color )( message );
		var lines = message.split( '\n' );
		var lastLine = lines.pop();

		lines.forEach( function (line ) {

			this.__terminal.writeln( line );

		}, this );

		this.__terminal.write( lastLine );
		this.__terminal.scrollToBottom();

	}
}
});
