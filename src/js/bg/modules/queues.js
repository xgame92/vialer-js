const Module = require('../lib/module')


/**
* This is a VoIPGRID vendor-specific module, responsible for
* updating information about calling queues.
* @module ModuleQueues
*/
class ModuleQueues extends Module {
    /**
    * @param {AppBackground} app - The background application.
    */
    constructor(app) {
        super(app)

        this.app.timer.registerTimer('bg:queues:size', () => {this._platformData(true)})
        this.app.on('bg:queues:selected', ({queue}) => {
            this.app.setState({queues: {selected: {id: queue ? queue.id : null}}}, {persist: true})

            if (this.app.env.isExtension) {
                if (queue) this.app.setState({ui: {menubar: {default: this.queueMenubarIcon(queue.queue_size)}}})
                else this.app.setState({ui: {menubar: {default: 'active'}}})
            }
            this.setQueueSizesTimer()
        })
    }


    _initialState() {
        return {
            queues: [],
            selected: {id: null},
            state: null,
        }
    }


    _onPopupAction(type) {
        this.setQueueSizesTimer()
    }


    async _platformData(silent = false) {
        // Only when authenticated.
        if (!this.app.state.user.authenticated) return
        if (!silent) this.app.setState({queues: {queues: [], state: 'loading'}})

        const res = await this.app.api.client.get('api/queuecallgroup/')
        let queues = res.data.objects

        for (const queue of queues) {
            // The queue size from the API is a string.
            queue.queue_size = parseInt(queue.queue_size, 10)
            // Queue size is not available.
            if (isNaN(queue.queue_size)) queue.queue_size = '?'
            // Update icon for toolbarbutton if this queuecallgroup
            // was selected earlier.
            if (queue.id === this.app.state.queues.selected.id) {
                this.app.setState({ui: {menubar: {default: this.queueMenubarIcon(queue.queue_size)}}})
            }
        }

        this.app.setState({queues: {queues: queues, state: null}}, {persist: true})
        this.setQueueSizesTimer()
    }


    queueMenubarIcon(size) {
        let queueState = 'queue'
        if (!isNaN(size)) {
            if (size < 10) queueState = `queue-${size}`
            else queueState = 'queue-10'
        }
        return queueState
    }


    /**
    * Register the queus update timer function and
    * the dynamic interval check.
    */
    setQueueSizesTimer() {
        // Set a dynamic timer interval.
        this.app.timer.setTimeout('bg:queues:size', () => {
            let timeout = 0
            // Only when authenticated.
            if (this.app.state.user.authenticated) {
                // Check every 20s when a queue is selected, no matter
                // if the popup is opened or closed.
                if (this.app.state.queues.selected.id) {
                    timeout = 20000
                    // Check more regularly when the popup is open and the
                    // queues widget is open.
                    if (this.app.state.ui.visible) timeout = 5000
                }
            }
            this.app.logger.debug(`${this}set queue timer to ${timeout} ms`)
            return timeout
        }, true)

        this.app.timer.startTimer('bg:queues:size')
    }


    toString() {
        return `${this.app}[queues] `
    }
}

module.exports = ModuleQueues