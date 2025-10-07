import { createContext, useContext, type ComponentType, type PropsWithChildren } from 'react';

type MDXComponents = Record<string, ComponentType<unknown>>;

type MDXProviderProps = PropsWithChildren<{ components?: MDXComponents | ((components: MDXComponents) => MDXComponents) }>;

const MDXComponentsContext = createContext<MDXComponents>({});

function mergeComponents(base: MDXComponents, overrides?: MDXProviderProps['components']): MDXComponents {
  if (!overrides) return base;
  if (typeof overrides === 'function') {
    return overrides(base);
  }
  return { ...base, ...overrides };
}

export function MDXProvider({ components, children }: MDXProviderProps) {
  const parent = useContext(MDXComponentsContext);
  const value = mergeComponents(parent, components);
  return <MDXComponentsContext.Provider value={value}>{children}</MDXComponentsContext.Provider>;
}

export function useMDXComponents(components?: MDXProviderProps['components']): MDXComponents {
  const context = useContext(MDXComponentsContext);
  return mergeComponents(context, components);
}

export function withMDXComponents<TProps>(Component: ComponentType<TProps>): ComponentType<TProps> {
  function WithMDXComponents(props: TProps) {
    return <Component {...props} mdxComponents={useMDXComponents()} />;
  }
  WithMDXComponents.displayName = `withMDXComponents(${Component.displayName ?? Component.name ?? 'Component'})`;
  return WithMDXComponents;
}

export default { MDXProvider, useMDXComponents, withMDXComponents };
