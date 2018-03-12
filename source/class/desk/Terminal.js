/**
 * A web terminal
 * @ignore (io)
 * @ignore (Terminal)
 */

qx.Class.define("desk.Terminal", 
{
	extend : qx.ui.container.Composite,

	/**
	* Constructor
	* @param options {Object} options
	*/
	construct : function ( options ) {
		options = options || {};
		this.base(arguments);
		this.setLayout( new qx.ui.layout.HBox() );

		this.__rand = Math.floor( 100000000 * Math.random());

		if ( options.standalone ) {
			var win = this.__window = new qx.ui.window.Window();
			win.set({
				layout : new qx.ui.layout.HBox(),
				width : 685,
				height : 390,
				contentPadding : 0,
				caption : 'Terminal'
			});
			win.add( this, {flex : 1} );
			win.open();
			win.center();

			win.addListener( 'close', function () {
				if ( this.__tabview ) {
					this.__tabview.getChildren().forEach( function (child) {
						child.getChildren()[0].dispose();
					});
					return;
				}
				this.dispose();
			}, this);

			win.addListener( 'mouseup', function () {
				this.__container.children[0].focus();
			}, this);

			win.addListener('keydown', this.__onKeyDownForNewTerminal, this, true);
		}

		this.__html = new qx.ui.embed.Html();
		this.__html.setHtml( '<div id = "' + this.__rand + '"></div>' );
		this.__html.setBackgroundColor( 'black' );
		this.__html.addListenerOnce( 'appear', this.__onAppear, this );
		this.add( this.__html, { flex : 1 } );
	},

	destruct : function () {
		this.__term.off('data', this.__term._sendData);
		this.__socket.removeEventListener('message', this.__term._getMessage);
		this.__socket.disconnect();
		this.__term = 0;
	},

	members : {
		__window : null,
		__socket : null,
		__tabview : null,
		__container : null,
		__term : null,
		__html : null,
		__nCols : null,
		__nRows : null,
		__rand : null,

		__getSocket : function ( namespace ) {
			var socket;
			desk.Actions.getInstance().getSocket().io.connecting
				.forEach( function (soc) {
				if (soc.nsp === namespace ) {
					socket = soc;
				}
			});

			return socket || io( namespace );
		},

		__onAppear : function () {
			var socket = this.__getSocket( '/xterm' );

			if ( socket.connected ) {
				this.__init();
			} else {
				socket.once( 'connect', this.__init.bind( this ));
			}
		},

		__init : function () {
			this.__getSocket( '/xterm' ).emit('newTerminal', {name : '' + this.__rand});
			this.__socket = this.__getSocket('/xterm' + this.__rand);
			this.__container = document.getElementById('' + this.__rand);
			this.__term = new Terminal( { cursorBlink : true } );
			this.__attach( this.__term, this.__socket );
			this.__term.on( 'keydown', this.__onKeyDownForSelectNext.bind(this));
			this.__term.open( this.__container, { focus : true } );
			this.__term.on('paste', function (data, ev) {
			this.__resize();
			this.__term.write(data);
		}.bind(this));

		this.__resize();
		this.addListener( 'appear', this.__resize, this );
		this.addListener( 'resize', function () {
			if ( this.__html.isVisible() ) {
				this.__resize();
			} 
		}, this );
		},

		__resize : function () {
			this.__container.children[0].focus();
			var size = this.__html.getInnerSize();
			var nCols = Math.floor( size.width / 8.5 );
			var nRows = Math.floor( size.height / 15 );
			if ( ( this.__nCols == nCols ) && ( this.__nRows === nRows) ) {
				return;
			}
			this.__nCols = nCols;
			this.__nRows = nRows;
			this.debug('resize : ', nCols, nRows);
			this.__term.resize( nCols, nRows );
			this.__term.children.forEach(function (child) {
				var style = child.style;
				style.fontSize = "14px";
				style.lineHeight = "15px";
			});
			this.__socket.emit("resize", {nCols : nCols, nRows : nRows});
		},

		__add : function ( el ) {
			var element = this.__tabview.addElement('terminal', el);
			element.setShowCloseButton(true);
			element.fireEvent('resize');
			element.addListener( 'close', function () {
				element.getChildren()[0].dispose();
				if ( !this.__tabview.getChildren().length ) this.__window.close();
			}, this);
			el.__tabview = this.__tabview;
			return element;
		},

		__selectNext : function (dir) {
			if ( !this.__tabview ) return;
			var children = this.__tabview.getChildren();
			var selected = this.__tabview.getSelection()[0];
			var index = children.indexOf( selected );
			var newIndex = ( children.length + index + dir ) % children.length;
			this.__tabview.setSelection( [ children[newIndex] ]);
		},

		__onKeyDownForSelectNext : function ( e ) {
			if ( !e || !e.ctrlKey) return;
			switch ( e.keyCode ) {
				case 37:
					this.__selectNext( -1 );
					break;
				case 39 :
					this.__selectNext( 1 );
					break;
			}
		},

		__onKeyDownForNewTerminal : function ( event ) {
			if ( event.isCtrlOrCommandPressed() 
				&& event.isAltPressed()
				&& ( event.getKeyIdentifier() === 'T') ) {

			if ( !this.__tabview ) {
				this.__tabview = new desk.TabView();
				this.__tabview.setContentPadding(0);
				this.__window.add(this.__tabview, { flex : 1 } );
				this.__add(this);
			}
			var terminal = new desk.Terminal();
			var element = this.__add(terminal);
				element.getButton().execute();
			}
		},

		__attach : function ( term, socket, bidirectional, buffered ) {
			bidirectional = (typeof bidirectional == 'undefined') ? true : bidirectional;

			term._flushBuffer = function () {
				term.write(term._attachSocketBuffer);
				term._attachSocketBuffer = null;
				clearTimeout(term._attachSocketBufferTimer);
				term._attachSocketBufferTimer = null;
			};

			term._pushToBuffer = function ( data ) {
				if (term._attachSocketBuffer) {
					term._attachSocketBuffer += data;
				} else {
					term._attachSocketBuffer = data;
					setTimeout( term._flushBuffer, 10 );
				}
			};

			term._getMessage = function ( data ) {
				if ( buffered ) {
					term._pushToBuffer( data );
				} else {
					term.write( data );
				}
			};

			term._sendData = function ( data ) {
				socket.send( data );
			};

			socket.addEventListener( 'message', term._getMessage );

			if ( bidirectional ) {
				term.on('data', term._sendData);
			}
		}
	}
});
