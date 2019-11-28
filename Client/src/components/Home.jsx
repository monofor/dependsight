import React, { Component } from "react";

export class Home extends Component {
  static displayName = Home.name;

  constructor(props) {
    super(props);
    this.packageNames = [];
    this.state = {
      data: [],
      loading: true,
      projectPath: localStorage.getItem("projectPath")
    };
  }

  handleChange = e => {
    localStorage.setItem("projectPath", e.target.value);
    this.setState({
      projectPath: e.target.value
    });
  };

  async getDependencies() {
    const path = this.state.projectPath;
    const result = await fetch("/api/dependencies", {
      method: "post",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectPath: path
      })
    });
    const json = await result.json();
    this.setState({ loading: false, data: json });
    this.checkLatestVersions();
  }

  async checkDependency(dependency) {
    if (this.packageNames.indexOf(dependency.name) !== -1) return;
    this.packageNames.push(dependency.name);
    const result = await fetch("/api/dependencies/check", {
      method: "post",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        packageName: dependency.name,
        sources: this.state.data.nugetConfig
      })
    });
    const json = await result.json();
    if (!json || json.length === 0) return;
    const value = json[0];
    this.setState(state => {
      const projects = state.data.projects.map(iproject => {
        const dependencies = iproject.dependencies.map(idependency => {
          if (idependency.name !== dependency.name) return idependency;
          return {
            ...idependency,
            isChecked: true,
            source: value.source,
            latestVersion: value.version,
            isLatest: value.version === idependency.currentVersion
          };
        });
        return {
          file: iproject.file,
          name: iproject.name,
          dependencies: dependencies
        };
      });
      return {
        data: {
          ...state.data,
          projects
        },
        loading: false
      };
    });
  }

  checkLatestVersions() {
    for (const project of this.state.data.projects) {
      for (const dependency of project.dependencies) {
        this.checkDependency(dependency);
      }
    }
  }

  getDependencyClassName(dependency) {
    if (!dependency.isChecked) return "";

    if (dependency.isLatest) return "bg-success";

    return "bg-warning";
  }

  getDependencyTextClassName(dependency) {
    if (!dependency.isChecked) return "";

    if (dependency.isLatest) return "font-bold text-success";

    return "font-bold text-warning";
  }

  componentDidMount() {
    if (this.state.projectPath && this.state.projectPath.length) {
      this.getDependencies();
    }
  }

  render() {
    return (
      <div>
        <div className="input-group mb-3">
          <input
            type="text"
            className="form-control"
            placeholder="Type your project path"
            onChange={this.handleChange}
            value={this.state.projectPath}
          />
          <div className="input-group-append">
            <button
              className="btn btn-outline-secondary"
              type="button"
              onClick={this.getDependencies.bind(this)}
            >
              Find Dependencies
            </button>
          </div>
        </div>
        {this.state.data &&
          this.state.data.projects &&
          this.state.data.projects
            .filter(item => item.dependencies.length)
            .map(item => (
              <div className="card mb-3 shadow-sm" key={item.name}>
                <div className="card-body p-2">
                  <h5 className="mb-0">{item.name}</h5>
                </div>
                <table className="table table-hover table-sm mb-0 text-monospace">
                  <thead>
                    <tr>
                      <th style={{ width: "20px" }} className="text-center">
                        #
                      </th>
                      <th>Package</th>
                      <th className="text-center">Version</th>
                      <th className="text-center" style={{ width: "120px" }}>
                        Latest
                      </th>
                      <th className="text-center" style={{ width: "120px" }}>
                        Is Latest
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.dependencies.map(dependency => (
                      <tr key={`${item.name}:${dependency.name}`}>
                        <td
                          className={this.getDependencyClassName(dependency)}
                        ></td>
                        <td>
                          {dependency.name}
                          {dependency.isParameter && (
                            <small className="d-block text-muted">
                              Parameter: $({dependency.parameterName})
                            </small>
                          )}
                        </td>
                        <td
                          className="text-center"
                          title={
                            dependency.isParameter
                              ? `Parameter: ${dependency.parameterName}`
                              : ""
                          }
                        >
                          <span
                            className={
                              dependency.isParameter ? "text-primary" : ""
                            }
                          >
                            {dependency.currentVersion}
                          </span>
                        </td>
                        <td className="text-center">
                          {dependency.isChecked
                            ? dependency.latestVersion
                            : "..."}
                        </td>
                        <td className="text-center">
                          <span
                            className={this.getDependencyTextClassName(
                              dependency
                            )}
                          >
                            {!dependency.isChecked
                              ? "..."
                              : dependency.isLatest
                              ? "Yes"
                              : "No"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        <pre className="d-none">{JSON.stringify(this.state.data, true, 4)}</pre>
      </div>
    );
  }
}
