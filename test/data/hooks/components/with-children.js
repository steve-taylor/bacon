import React from 'react';
import propTypes from 'prop-types';

import useIsomorphicContext from '../../../../src/use-isomorphic-context';

import WithChildrenContext from '../../context/with-children-context';

export default function WithChildren({children}) {
    const {x} = useIsomorphicContext(WithChildrenContext);

    return (
        <section>
            <div className="this-component">
                {x}
            </div>

            {!!React.Children.count(children) && (
                <div className="children">
                    {children}
                </div>
            )}
        </section>
    );
}

WithChildren.propTypes = {
    children: propTypes.node,
};
