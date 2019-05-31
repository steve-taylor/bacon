import React from 'react';
import propTypes from 'prop-types';

import Connect from '../../../../src/connect';

import WithChildrenContext from '../../context/with-children-context';

const WithChildren = ({children}) => (
    <section>
        <div className="this-component">
            <Connect context={WithChildrenContext}>
                {({x}) => x}
            </Connect>
        </div>

        {!!React.Children.count(children) && (
            <div className="children">
                {children}
            </div>
        )}
    </section>
);

WithChildren.propTypes = {
    children: propTypes.node,
};

export default WithChildren;
