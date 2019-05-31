import React from 'react';
import ReactDOMServer from 'react-dom/server';
import bacon from 'baconjs';

import {IsomorphicContext, ServerContext, HydrationContext, SERVER} from './context';
import {SSR_TIMEOUT_ERROR} from './errors';
import keyFor from './key-for';
import Connect from './connect';

/**
 * A function to create a Bacon.js <code>Observable</code>, optionally taking initial data when hydrating in the browser.
 *
 * @callback getData
 * @param {Object} props       - props passed to the isomorphic component, some of which it may use to look up data
 * @param {Object} [hydration] - initial data if we're in the browser and hydrating
 */

/**
 * Create an isomorphic version of a React component.
 *
 * When a React context is provided, the state emitted by the <code>getData</code> stream is made available via the context, allowing any
 * child of this component to tap into the state via the context.
 *
 * When a React context isn't provided, the emitted state is fed directly into the component's props.
 *
 * If you want to pass any props to the underlying component, provide a mapping function via <code>passthrough</code> that, given the props
 * passed to the isomorphic component, returns the subset of those props to be passed through to the underlying component.
 *
 * Regardless of whether and how you specify <code>passthrough</code>, <code>props.children</code> will always be passed through.
 *
 * When <code>context</code> isn't specified, passed-through props override <code>state</code> emitted by the <code>getData</code> stream.
 *
 * @param {Object}        isomorphicComponent               - isomorphic component details
 * @param {string}        isomorphicComponent.name          - name
 * @param {Function}      isomorphicComponent.component     - React component
 * @param {React.Context} [isomorphicComponent.context]     - context to provide and consume the data stream
 * @param {Function}      isomorphicComponent.getData       - data stream creation function
 * @param {Function}      [isomorphicComponent.passthrough] - a function to pass props through to the underlying component
 * @param {number}        [isomorphicComponent.timeout]     - the number of milliseconds to wait for the stream to emit its first value
 * @param {Object}        [isomorphicComponent.propTypes]   - propType validations
 * @returns {Function} the created isomorphic component
 */
export default function isomorphic({
    name,
    component: C,
    context,
    getData,
    passthrough = () => ({}),
    timeout,
    propTypes, // eslint-disable-line react/forbid-foreign-prop-types
}) {
    // When context isn't provided, inject the state directly into the component.
    // TODO: Make this use case more efficient by bypassing context completely.
    const Context = context || React.createContext(null);
    const Component = context ? C : ({children, ...props}) => ( // eslint-disable-line react/prop-types
        <Connect context={Context}>
            {(state) => (
                <C
                    {...state}
                    {...passthrough(props)}
                >
                    {children}
                </C>
            )}
        </Connect>
    );

    return class Isomorphic extends React.Component {
        static __isomorphic_name__ = name; // eslint-disable-line camelcase
        static displayName = name;
        static propTypes = propTypes;

        render() {
            const {children, ...props} = this.props;

            return (
                <ServerContext.Consumer>
                    {(serverContext) => {
                        if (serverContext) {
                            const {getStream, registerStream, onError} = serverContext;
                            const key = keyFor(name, props);
                            let stream$ = getStream(key);

                            // If the stream hasn't been created, create and register it.
                            if (!stream$) {
                                stream$ = getData(props, undefined).first();
                                registerStream(key, stream$);
                            }

                            let immediate = true;
                            let immediateValue = null;
                            let hasImmediateValue = false;

                            bacon
                                .mergeAll(
                                    stream$
                                        .first()
                                        .doAction(({state}) => {
                                            if (immediate) {
                                                hasImmediateValue = true;
                                                immediateValue = state;
                                            }
                                        })
                                        .doError((error) => {
                                            if (immediate) {
                                                onError(error);
                                            }
                                        }),
                                    // Insert an error into the stream after the timeout, if specified, has elapsed.
                                    timeout === undefined
                                        ? bacon.never()
                                        : bacon.later(timeout).flatMapLatest(() => new bacon.Error(SSR_TIMEOUT_ERROR))
                                )
                                .firstToPromise()
                                .then(() => {
                                    if (!hasImmediateValue) {
                                        // When the stream resolves later, continue walking the tree.
                                        ReactDOMServer.renderToStaticMarkup(
                                            <IsomorphicContext.Provider value={SERVER}>
                                                <ServerContext.Provider value={{getStream, registerStream}}>
                                                    <Context.Provider
                                                        value={{
                                                            data$: stream$.map(({state}) => state),
                                                            name,
                                                        }}
                                                    >
                                                        <Component {...passthrough(props)}>
                                                            {children}
                                                        </Component>
                                                    </Context.Provider>
                                                </ServerContext.Provider>
                                            </IsomorphicContext.Provider>
                                        );
                                    }
                                })
                                .catch((error) => {
                                    onError(error);
                                });

                            immediate = false;

                            // If the stream is resolved, render it.
                            if (hasImmediateValue) {
                                return (
                                    <Context.Provider
                                        value={{
                                            data$: bacon.constant(immediateValue),
                                            name,
                                        }}
                                    >
                                        <Component {...passthrough(props)}>
                                            {children}
                                        </Component>
                                    </Context.Provider>
                                );
                            }
                        } else {
                            return (
                                <HydrationContext.Consumer>
                                    {(getHydration) => {
                                        const {hydration, elementId} = getHydration ? getHydration(name, props) : {};
                                        const data$ = getData(props, hydration).map(({state}) => state);

                                        return (
                                            <Context.Provider value={{data$, name, elementId}}>
                                                <Component {...passthrough(props)}>
                                                    {children}
                                                </Component>
                                            </Context.Provider>
                                        );
                                    }}
                                </HydrationContext.Consumer>
                            );
                        }
                    }}
                </ServerContext.Consumer>
            );
        }
    };
}
