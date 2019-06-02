# IsoReact &middot; [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/isoreact/bacon1/blob/master/LICENSE) [![npm version](https://img.shields.io/npm/v/@isoreact/bacon1.svg?style=flat)](https://www.npmjs.com/package/@isoreact/bacon1) ![npm](https://img.shields.io/npm/dw/@isoreact/bacon1.svg) [![Build Status](https://travis-ci.org/isoreact/bacon1.svg?branch=develop)](https://travis-ci.org/isoreact/bacon1) [![PRs Welcome](https://img.shields.io/badge/pull_requests-welcome-brightgreen.svg)](https://github.com/isoreact/bacon1/blob/master/CONTRIBUTING.md)

IsoReact is a collection of libraries to build isomorphic React components. Each edition of IsoReact focuses on a
specific state management library. IsoReact-Bacon1 is the Bacon.js 1 edition of IsoReact.

Features:

* Server-side render fully populated components (not just loading states).
* Hydrate server-side rendered components without hitting APIs for the initial
  client-side render.
* State management with [Bacon.js 1](https://baconjs.github.io/api.html).
* Connect state to the component tree via the [new context API](https://reactjs.org/docs/context.html).

This is a library, not a framework. It is focused on state management and
isomorphism and should otherwise stay out of your way.

## Installation

```
npm i -S @isoreact/bacon1
```

## Examples

See [isoreact/example](https://github.com/isoreact/bacon1-example)

## Usage

Create a context to connect a Bacon.js 1 event stream to your React component:

```js
// profile-context.js
import React from 'react';

export default React.createContext();
```

Create your React component hierarchy, connecting your context to it using `<Connect context={yourContext} />`:

```jsx harmony
// profile.js
import React from 'react';
import {Connect} from '@isoreact/bacon1';
import profileContext from './profile-context';

const ProfileName = () => (
    <section className="profile__name">
        <Connect
            context={profileContext}
            isEqual={(a, b) => (
                a.isLoading === b.isLoading
                && a.name === b.name
            )}
        >
            {({isLoading, name}) => (
                isLoading ? (
                    <em>
                        Loading...
                    </em>
                ) : (
                    name
                )
            )}
        </Connect>
    </section>
);

const ProfilePhoto = () => (
    <section className="profile__photo">
        <Connect context={profileContext}>
            {({isLoading, photo}) => (
                <img
                    className="profile__photo-img"
                    src={isLoading ? '/static/img/profile-loading.gif' : photo}
                    alt={isLoading ? 'Loading profile' : 'Profile photo'}
                />
            )}
        </Connect>
    </section>
);

const Profile = () => (
    <section className="profile">
        <ProfileName />
        <ProfilePhoto />
    </section>
);

export default Profile;
```

You might have noticed `isEqual` in one of the `<Connect />` elements. It's an optional function that allows `Connect`
to skip duplicates when it determines they're equal.

Define your component's event stream and make it isomorphic:

```js
// iso-profile.js
import PropTypes from 'prop-types';
import Bacon from 'baconjs';
import {isomorphic} from '@isoreact/bacon1';
import Profile from './profile';
import profileContext from './profile-context';
import fetchName from './streams/fetch-name';
import fetchPhoto from './streams/fetch-photo';

export default isomorphic({
    name: 'iso-profile',
    component: Profile,
    context: profileContext,
    getData: (props, hydration, immediate) => {
        const {userId} = props;
        
        const name$ = hydration
            ? Bacon.constant({name: hydration.name})
            : fetchName(userId);
        
        const photo$ = hydration
            ? Bacon.constant({photo: hydration.photo})
            : fetchPhoto(userId);
        
        return Bacon
            .combineTemplate({
                // React component rendered with this state as its props
                state: {
                    name: name$,
                    photo: photo$,
                },
                // Data rendered alongside the React element in the HTML page
                hydration: {
                    name: name$,
                    photo: photo$,
                },
                // Additional data accumulated during server-side rendering
                data: {
                    maxAge: 60,
                },
            })
            // Start with a loading state (which is skipped by Bacon.js when combineTemplate resolves immediately) ...
            .startWith({
                state: {
                    isLoading: true,
                },
            })
            // ... but skip it if an immediate value isn't required
            .skip(immediate ? 0 : 1);
    },
    propTypes: {
        userId: PropTypes.string.isRequired,
    },
});
```

The general contract of `getData(props, hydration, immediate)` is:

* Return an observable that emits objects of the form `{state, hydration, data}` where both `state` and `hydration` are
  objects and `data` is any additional data you want to accumulate during server-side rendering.
* If the third parameter (`immediate`) provided to `getData` is `true`, the observable is expected to immediately
  produce an event.
* Events must contain `hydration` during server-side rendering.
* Events can contain `hydration` and/or `data` client-side, but it will have no effect.
* Keep hydration small to keep server-side rendered HTML pages small. Only attach the minimum amount of data required
  to hydrate isomorphic components without them having to fetch data from APIs.

Somewhere on the server:

```jsx harmony
import React from 'react';
import {renderToHtml} from '@isoreact/bacon1';
import {IsoProfile} from './iso-profile';

// Server-side render an HTML page consisting of the profiles from a list of user IDs.
async function renderUserProfilesPage(userIds) {
    let maxAge = 60; // Default max-age to 60s

    // Generate server-side rendered profile of users
    const htmlArray = await Promise.all(
        userIds.map((userId) => renderToHtml(
            <IsoProfile userId={userId} />,
            {
                onData: (data) => {
                    // Keep the smallest non-zero maxAge
                    if (data.maxAge && data.maxAge < maxAge) {
                        maxAge = data.maxAge;
                    }
                },
            }
        ))
    );

    return {
        maxAge,
        html: `<body>${htmlArray.join('')}</body>`,
    };
}
```

When `renderToHtml` is called, it will call each isomorphic components' `getData` function, passing in the isomorphic
component's props (in this case, `userId`). When the stream returned by `getData` produces its first event (an object
consisting of `state` to inject into the React component and `hydration` to attach to the HTML page), the isomorphic
component's React component will be rendered with the `state` as its `props` and the `hydration` data will be rendered
adjacent to it in the HTML page. The `data` property of the event will be passed to the `onData` function specified in
`renderToHtml`, if specified at all. It is up to the `onData` function to accumulate `data` objects as it sees fit,
bearing in mind that `onData` is called in render order, which is defined by `ReactDOM.renderToString`.

Somewhere on the client:

```js
import {hydrate} from '@isoreact/bacon1';
import IsoProfile from './iso-profile';

// Hydrate all instances of iso-profile on the page
hydrate(IsoProfile);
```

When `hydrate` is called, it finds all the server-side rendered instances of the isomorphic component in the DOM, reads
their attached `props` and `hydration` data, then calls `getData(props, hydration, immediate)`, expecting the client to
render the profiles synchronously, without having to load data from APIs.

Bear in mind that isomorphic components are just React components, so you can use them directly in JSX and you don't
even need to initially render them on the server. You could even use this library just for connecting to Bacon.js.

## Contextless form

In some situations, context is overkill, because your UI is fairly shallow and there is not much benefit, if any, to be
gained by using a context. And in some cases, you may be using a component from a third-party library as the `copmonent`
parameter. For this reason, `context` is optional. If you don't provide a `context`, the `state` of the stream returned
by `getData` will be fed directly into the component's props (which otherwise doesn't receive props from `isomorphic`).

```jsx harmony
import React from 'react';

export default function Profile({isLoading, name, photo}) {
    return (
        <section className="profile">
            <section className="profile__name">
                {isLoading ? (
                    <em>
                        Loading...
                    </em>
                ) : (
                    name
                )}
            </section>
            <section className="profile__photo">
                <img
                    className="profile__photo-img"
                    src={isLoading ? '/static/img/profile-loading.gif' : photo}
                    alt={isLoading ? 'Loading profile' : 'Profile photo'}
                />
            </section>
        </section>
    );
}
```

```jsx harmony
import PropTypes from 'prop-types';
import Bacon from 'baconjs';
import {isomorphic} from '@isoreact/bacon1';
import Profile from './profile';
import fetchName from './streams/fetch-name';
import fetchPhoto from './streams/fetch-photo';

export default isomorphic({
    name: 'iso-profile',
    component: Profile,
    getData: (props, hydration, immediate) => {
        const {userId} = props;
        
        const name$ = hydration
            ? Bacon.constant({name: hydration.name})
            : fetchName(userId);
        
        const photo$ = hydration
            ? Bacon.constant({photo: hydration.photo})
            : fetchPhoto(userId);
        
        return Bacon
            .combineTemplate({
                // React component rendered with this state as its props
                state: {
                    name: name$,
                    photo: photo$,
                },
                // Data rendered alongside the React element in the HTML page
                hydration: {
                    name: name$,
                    photo: photo$,
                },
                // Additional data accumulated during server-side rendering
                data: {
                    maxAge: 60,
                },
            })
            // Start with a loading state (which is skipped by Bacon.js when combineTemplate resolves immediately) ...
            .startWith({
                state: {
                    isLoading: true,
                },
            })
            // ... but skip it if an immediate value isn't required
            .skip(immediate ? 0 : 1);
    },
    propTypes: {
        userId: PropTypes.string.isRequired,
    },
});
```

This saves you from the following additional boilerplate:

```jsx harmony
// NOTE: Don't do this!

const context = React.createContext(null);
const component = () => (
    <Connect context={context}>
        {(state) => (
            <Profile {...state} />
        )}
    </Connect>
);

export default isomorphic({
    name: 'iso-profile',
    context,
    component,
    getData,
});
```

However, it means that React is potentially diffing larger chunks of virtual DOM.

## Hooks

A custom hook is provided as an alternative to `<Connect />`.

```jsx harmony
// profile.js
import React from 'react';
import {useIsomorphicContext} from '@isoreact/bacon1';
import profileContext from './profile-context';

export default function Profile() {
    const {isLoading, name, photo} = useIsomorphicContext(
        profileContext, // same as Connect's context prop
        (a, b) => (     // same as Connect's isEqual prop
            a.isLoading === b.isLoading
            && a.name === b.name
            && a.photo === b.photo
        )
    );

    return (
        <section className="profile">
            <section className="profile__name">
                {isLoading ? (
                    <em>
                        Loading...
                    </em>
                ) : (
                    name
                )}
            </section>
            <section className="profile__photo">
                <img
                    className="profile__photo-img"
                    src={isLoading ? '/static/img/profile-loading.gif' : photo}
                    alt={isLoading ? 'Loading profile' : 'Profile photo'}
                />
            </section>
        </section>
    );
}
```

## Support for styled-components

The server-side rendering portion of the above example can be updated as follows:

```jsx harmony
import React from 'react';
import {renderToHtml, StyledComponentsServerRenderer} from '@isoreact/bacon1';
import {IsoProfile} from './iso-profile';

// Server-side render an HTML page consisting of the profiles from a list of user IDs.
async function renderUserProfilesPage(userIds) {
    // Generate server-side rendered profile of users
    const renderer = new StyledComponentsServerRenderer();
    const htmlArray = await Promise.all(
        userIds.map((userId) => renderToHtml(
            <IsoProfile userId={userId} />,
            {renderer}
        ))
    );

    return `<head>${renderer.getStyleTags()}</head><body>${htmlArray.join('')}</body>`;
}
```

This uses `StyledComponentsServerRenderer` as an alternative renderer, which uses `ServerStyleSheet` from
styled-components to gather rendered stylesheets.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) in this repo for contribution guidelines.
