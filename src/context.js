import React from 'react';

export const ServerContext = React.createContext(null); // (getStream, registerStream?, onError?)

export const HydrationContext = React.createContext(null); // (name, props) => ({hydration, elementId})

export const IsomorphicContext = React.createContext(null); // {server: {getStream, registerStream?, onError?}, hydration: {hydration, elementId}}

export const HYDRATION = Symbol('hydration');
export const SERVER = Symbol('ssr');
