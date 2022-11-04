/**
 * A web terminal
 */

qx.Class.define("desk.Xterm.Terminal", 
{
	extend : desk.Xterm.Logger,

	/**
	* Constructor
	* @param options {Object} options
	*/
	construct : function ( options ) {

		this.base( arguments );
		options = options || {};
		this.addListenerOnce( 'appear', this.__onAppear, this );
		this.addListener( "resizeTerminal", this.__resize, this );

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

		__getSocket : function ( namespace ) {

			const socket = desk.Actions.getInstance().getSocket().io.nsps[ namespace ];
			return  socket ? socket : require('socket.io-client')( namespace, {path : desk.FileSystem.getBaseURL() + 'socket.io'} );

		},

		__onAppear : async function () {

			const term = this._terminal;
			let socket = this.__getSocket( '/xterm' );

			if ( !socket.connected )
				await new Promise( res => socket.once( 'connect', res ) );

			this.__getSocket( '/xterm' ).emit( 'newTerminal', { name : '' + this._rand } );
			socket = this.__socket = this.__getSocket( '/xterm' + this._rand );
			this.__getMessage = term.write.bind( term );
			socket.addEventListener( 'message', this.__getMessage );
			term.onData( socket.send.bind( socket ) );

		},

		__resize : function ( event ) {

			this.__socket.emit( "resize", event.getData() );
			this._terminal.focus();

		}

	}
});
