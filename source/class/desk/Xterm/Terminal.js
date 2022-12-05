/**
 * A web terminal
 */

qx.Class.define("desk.Xterm.Terminal", 
{
	extend : desk.Xterm.Container,

	/**
	* Constructor
	* @param options {Object} options
	*/
	construct : function ( options ) {

		this.base( arguments );
		options = options || {};
		this.addListenerOnce( 'appear', this.__onAppear, this );

		if ( options.standalone ) {

			const win = new qx.ui.window.Window();

			win.set( {
				layout : new qx.ui.layout.HBox(),
				width : 739,
				height : 456,
				contentPadding : 0,
				caption : 'Terminal'
			} );

			win.add( this, { flex : 1 } );
			win.open();
			win.center();
			win.addListener( 'close', this.dispose, this );

		}

	},

	destruct : function () {

		this.__socket.removeEventListener( 'message', this.__getMessage );
		this.__socket.disconnect();

	},

	members : {

		__socket : null,
		__getMessage : null,

		__getSocket : async function ( namespace ) {

			let socket = desk.Actions.getInstance().getSocket().io.nsps[ namespace ];

			if ( !socket )
				socket = require('socket.io-client')( namespace, {
					path : desk.FileSystem.getBaseURL() + 'socket.io'} );

			if ( !socket.connected )
				await new Promise( res => socket.once( 'connect', res ) );

			return socket;

		},

		__onAppear : async function () {

			const term = this._terminal;
			const mainSocket = await this.__getSocket( '/xterm' );
			const rand = Math.floor( 100000000 * Math.random());
			await new Promise( res => mainSocket.emit( 'newTerminal',	{ name : '' + rand }, res ) );
			const socket = this.__socket = await this.__getSocket( '/xterm' + rand );
			this.__getMessage = term.write.bind( term );
			socket.addEventListener( 'message', this.__getMessage );
			term.onData( socket.send.bind( socket ) );
			this.addListener( "resizeTerminal", this.__resize, this );

		},

		__resize : function ( event ) {

			this.__socket.emit( "resize", event.getData() );
			this._terminal.focus();

		}

	}
});
